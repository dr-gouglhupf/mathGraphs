/*!
 * mathGraths
 * https://github.com/dr-gouglhupf/mathGraths/
 * Version: 0.1-alpha
 *
 * Copyright 2015 Justus Leiner
 * Released under the MIT license
 * https://github.com/dr-gouglhupf/mathGraths/blob/master/LICENSE
 */

var grath = function (context, settings){
	"use strict";

	// Default global config which can be modivied with the 'settings' parameter
	var defaultConfig = this.options = {
		size: {
			width: function() {
				return (window.innerHeight < window.innerWidth) ? window.innerHeight-20 : window.innerWidth-20;
			},
			height: function() {
				return (window.innerHeight < window.innerWidth) ? window.innerHeight-20 : window.innerWidth-20;
			}
		},
		gridSettings: {
			range: {
				xM: -10,
				xP: 10,
				yM: -10,
				yP: 10
			},
			colors: {
				axes: "#E4EDF0",
				temLines: "#7f8c8d",
				text: "#7f8c8d"
			},
			text: true
		},
		toopTips: {
			enable: true,
			roundEdges: true,
			width: 140,
			fontColor: "#e3f2fd",
			template: "P(<x(1)>, <y(1)>)<br>f(x) = <formula>"
		},
		fontType: "Arial",
		changeOnResize: true,
		randomColors: true,
		colors: ["rgb(26, 188, 156)","rgb(46, 204, 113)","rgb(52, 152, 219)","rgb(155, 89, 182)","rgb(52, 73, 94)","rgb(22, 160, 133)","rgb(39, 174, 96)","rgb(41, 128, 185)","rgb(142, 68, 173)","rgb(44, 62, 80)","rgb(241, 196, 15)","rgb(230, 126, 34)","rgb(231, 76, 60)","rgb(243, 156, 18)","rgb(211, 84, 0)","rgb(192, 57, 43)"]
	};

	// Defines a few handy function in the helpers class

	var helpers = {};

	var merge = helpers.merge = function (target, source) {      
	    /* Merges two (or more) objects,
	       giving the last one precedence */
	    
	    if ( typeof target !== 'object' ) {
	        target = {};
	    }
	    for (var property in source) {
	        if ( source.hasOwnProperty(property) ) {
	            var sourceProperty = source[ property ];
	            if ( typeof sourceProperty === 'object' ) {
	                target[ property ] = helpers.merge( target[ property ], sourceProperty );
	                continue;
	            }
	            target[ property ] = sourceProperty; 
	        } 
	    }
	    for (var a = 2, l = arguments.length; a < l; a++) {
	        merge(target, arguments[a]);
	    }
	    return target;
	},
	getRandomArbitrary = helpers.getRandomArbitrary = function (min, max) {
	    return Math.random() * (max - min) + min;
	},
	complileTemplate = helpers.complileTemplate = function (tempStr) {

		// Gets the template as a string and converts it in an javascript functions which are then return in an array

		var functionsAry = [],
			tempParts = tempStr.split("<br>");

		for (var i = 0; i < tempParts.length; i++) {
			var functionComp = 
				"return '"+tempParts[i]
				.split("<").join("'+ dataset.")
				.split(">").join("+'")+"'";

			functionsAry.push(new Function ("dataset", functionComp));
		};

		return functionsAry;
	},
	decimalAdjust = helpers.decimalAdjust = function (type, value, exp) {
		// If the exp is undefined or zero...
		if (typeof exp === 'undefined' || +exp === 0) {
			return Math[type](value);
		}
		value = +value;
		exp = +exp;
		// If the value is not a number or the exp is not an integer...
		if (isNaN(value) || !(typeof exp === 'number' && exp % 1 === 0)) {
			return NaN;
		}
		// Shift
		value = value.toString().split('e');
		value = Math[type](+(value[0] + 'e' + (value[1] ? (+value[1] - exp) : -exp)));
		// Shift back
		value = value.toString().split('e');
		return +(value[0] + 'e' + (value[1] ? (+value[1] + exp) : exp));
	}

	// Adds the decimalAdjust function to the standard math class if not already there
	if (!Math.round10) {
		Math.round10 = function(value, exp) {
			return decimalAdjust('round', value, exp);
		};
	}

	// Adds a function to the Canvas class which can draw rectangles with rounded edges
	CanvasRenderingContext2D.prototype.roundRect = 
		function(x, y, width, height, radius, fill, stroke) {
			if (typeof stroke == "undefined" ) {
				stroke = true;
			}
			if (typeof radius === "undefined") {
				radius = 5;
			}

			this.beginPath();
			this.moveTo(x + radius, y);
			this.lineTo(x + width - radius, y);
			this.quadraticCurveTo(x + width, y, x + width, y + radius);
			this.lineTo(x + width, y + height - radius);
			this.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
			this.lineTo(x + radius, y + height);
			this.quadraticCurveTo(x, y + height, x, y + height - radius);
			this.lineTo(x, y + radius);
			this.quadraticCurveTo(x, y, x + radius, y);
			this.closePath();

			if (stroke) {
				this.stroke();
			}
			if (fill) {
				this.fill();
			}        
		}

	// Main variables

	this.canvas = context.canvas;
	this.ctx = context;
	this.initialized = false;
	this.functions = [];

    this.options = helpers.merge(defaultConfig, settings);
	this.functionsComp = helpers.complileTemplate(this.options.toopTips.template);

	this.canvasWidth = this.canvas.width  = this.options.size.width();
	this.canvasHeight = this.canvas.height = this.options.size.height();



	// In this variable every function will be stored here that can be accessed out side of the main function 
	var exports = {};

	this.drawGrid = function() {
	    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); //reset

		var canvasWidth = this.canvas.width,
			canvasHeight = this.canvas.height,
			range = this.options.gridSettings.range,
			unitsX = range.xM*-1+range.xP+1,
	    	unitsY = range.yM*-1+range.yP+1,
	    	unitsGapX = (canvasWidth) / unitsX,
	    	unitsGapY = (canvasHeight) / unitsY,
	    	middleX = (unitsGapX * (range.xM*-1+1)) - unitsGapX/2,
	    	middleY = this.calculateY((unitsGapY * (range.yM*-1+1)) - unitsGapY/2);

		this.ctx.restore();

	    this.ctx.lineWidth = 2;
	    this.ctx.strokeStyle = "#7f8c8d";
	    this.ctx.beginPath();
	    this.ctx.moveTo(0, middleY);
	    this.ctx.lineTo(canvasWidth, middleY);
	    this.ctx.stroke();
	    this.ctx.beginPath();
	    this.ctx.moveTo(middleX, 0);
	    this.ctx.lineTo(middleX, canvasHeight);
	    this.ctx.stroke();

		this.ctx.save();

	    for (var i = 0; i < unitsX; i++) {
	        if (i+range.xM != 0) this.drawUnitX(unitsGapX*i+unitsGapX/2, middleY, i+range.xM);
	    };
	    for (var i = unitsY; i >= 0; i--) {
	        if (i+range.yM != 0) this.drawUnitY(middleX, this.calculateY(unitsGapY*i+unitsGapY/2), i+range.yM);
	    };

	    this.initialized = true;
	    this.middleX = middleX;
	    this.middleY = middleY;
	    this.unitsGapX = unitsGapX;
	    this.unitsGapY = unitsGapY;
	}
	this.calculateY = function(value) {
		return this.canvasHeight - value;
	}
	this.drawUnitX = function(posX, posY, title) {
	    this.ctx.lineWidth = 2;
	    this.ctx.strokeStyle = this.options.gridSettings.colors.axes;
	    this.ctx.beginPath();
	    this.ctx.moveTo(posX, 0);
	    this.ctx.lineTo(posX, this.canvasHeight);
	    this.ctx.stroke();
	    this.ctx.lineWidth = 2;
	    this.ctx.strokeStyle = this.options.gridSettings.colors.temLines;
	    this.ctx.beginPath();
	    this.ctx.moveTo(posX, posY - 5);
	    this.ctx.lineTo(posX, posY + 5);
	    this.ctx.stroke();
	    if (this.options.gridSettings.text) {
		    this.ctx.font="14px " + this.options.fontType;
		    this.ctx.fillStyle = this.options.gridSettings.colors.text;
		    this.ctx.fillText(title,posX-this.ctx.measureText(title.toString()).width/2,posY - 10);
		}
	}
	this.drawUnitY = function(posX, posY, title) {
	    this.ctx.lineWidth = 2;
	    this.ctx.strokeStyle = this.options.gridSettings.colors.axes;
	    this.ctx.beginPath();
	    this.ctx.moveTo(0, posY);
	    this.ctx.lineTo(this.canvasWidth, posY);
	    this.ctx.stroke();
	    this.ctx.lineWidth = 2;
	    this.ctx.strokeStyle = this.options.gridSettings.colors.temLines;
	    this.ctx.beginPath();
	    this.ctx.moveTo(posX - 5, posY);
	    this.ctx.lineTo(posX + 5, posY);
	    this.ctx.stroke();
	    if (this.options.gridSettings.text) {
		    this.ctx.font="14px " + this.options.fontType;
		    this.ctx.fillStyle = this.options.gridSettings.colors.text;
		    this.ctx.fillText(title,posX + 10,posY+5);
		}
	}
	this.funGraph = function (funcStr, color) {
	    var xx, yy, xN, yN, previous = {x: 0, y: 0}, dx=4, points=[],
	    	iMax = Math.round((this.canvasWidth-this.middleX)/dx),
	    	iMin = Math.round(-this.middleX/dx),
	    	func = math.compile(funcStr);
	    this.ctx.beginPath();
	    this.ctx.lineWidth = 2;
	    this.ctx.strokeStyle = color;
	    for (var i=iMin;i<=iMax;i++) {
	        xx = dx*i; yy = this.unitsGapY*func.eval({x: xx/this.unitsGapX});
	        if (this.middleY-yy >= 0) {
		        if (previous.y > yy && this.middleY-previous.y < 0) {
		        	points.push({x: this.middleX+previous.x, y: this.middleY-previous.y});
		        	this.ctx.moveTo(this.middleX+previous.x,this.middleY-previous.y);
		        }
		        points.push({x: this.middleX+xx, y: this.middleY-yy});
		        this.ctx.lineTo(this.middleX+xx,this.middleY-yy);
		    } else if (i!=iMin && previous.y < yy && this.middleY-previous.y > 0) {
	        	xN = xx+dx, yN = this.unitsGapY*func.eval({x: xN/this.unitsGapX});
	        	this.ctx.lineTo(this.middleX+xN,this.middleY-yN);
	        	points.push({x: this.middleX+xN, y: this.middleY-yN});
	        	break;
	        }
		    previous = {x: xx, y: yy};
	    }
	    this.ctx.stroke();

	    return points;
	}
	exports.drawGraths = this.drawGraths = function (grathFuncs) {
		this.drawGrid();

		this.functions = [];

		for(var i = 0; i < grathFuncs.length; i++) {
			this.functions.push({formula: grathFuncs[i]});
			try {
				if (this.options.randomColors) {
					this.functions[i].color = this.options.colors[Math.round(helpers.getRandomArbitrary(0, this.options.colors.length-1))];
			    	this.functions[i].points = this.funGraph(grathFuncs[i],this.functions[i].color);
			    } else {
			    	this.functions[i].color = this.options.colors[i];
			    	this.functions[i].points = this.funGraph(grathFuncs[i],this.options.colors[i]);
			    }
			} catch (e) {
				if (typeof this.errorElem !== "undefined") {
					this.errorElem.innerHTML = "<p>" + e.message + "</p>";
				} else {
					console.log(e.message);
				}
			}
		}
	}
	this.resizeGraths = function () {
		this.drawGrid();

		for(var i = 0; i < this.functions.length; i++) {
			this.funGraph(this.functions[i].formula, this.functions[i].color);
		}
	}
	exports.addGraths = this.addGraths = function (grathFuncs) {
		if(!this.initialized) {
			this.drawGrid();
		}

		var prevLenght = this.functions.length;

		for (var i = 0; i < grathFuncs.length; i++) {
			this.functions.push({formula: grathFuncs[i]});
		}

		for (var i = 0; i < grathFuncs.length; i++) {
			try {
				if (this.options.randomColors) {
					this.functions[i+prevLenght].color = this.options.colors[Math.round(helpers.getRandomArbitrary(0, this.options.colors.length-1))];
			    	this.functions[i+prevLenght].points = this.funGraph(grathFuncs[i], this.functions[i+prevLenght].color);
			    } else {
			    	this.functions[i+prevLenght].color = this.options.colors[i+prevLenght];
			    	this.functions[i+prevLenght].points = this.funGraph(grathFuncs[i],this.options.colors[i+prevLenght]);
			    }
			} catch (e) {
				if (typeof this.errorElem !== "undefined") {
					this.errorElem.innerHTML = "<p>" + e.message + "</p>";
				} else {
					console.log(e.message);
				}
			}
		}
	}
	this.updateGraths = function () {
		this.drawGrid();

		for(var i = 0; i < this.functions.length; i++) {
			var pointsAry = this.functions[i].points;
		    this.ctx.beginPath();
		    this.ctx.lineWidth = 2;
		    this.ctx.strokeStyle = this.functions[i].color;
		    this.ctx.moveTo(pointsAry[0].x,pointsAry[0].y)
			for(var i2 = 1; i2 < pointsAry.length; i2++) {
			    this.ctx.lineTo(pointsAry[i2].x,pointsAry[i2].y);
			}
			this.ctx.stroke();
		}
	}
	this.updateHover = function (e) {
		e.preventDefault();
		e.stopPropagation();
		var mouseX=parseInt(e.clientX-this.canvas.offsetLeft),
			mouseY=parseInt(e.clientY-this.canvas.offsetTop);

		var pointX, pointY,
			pointsAry = [],
			grathAry = [];
		for (var i = 0; i < this.functions.length; i++) {
			pointsAry = this.functions[i].points;
			for (var i2 = 0; i2 < pointsAry.length; i2++) {
				pointX = pointsAry[i2].x; 
				pointY = pointsAry[i2].y;
				if (mouseX-pointX < 12 && mouseX-pointX > -12 && (mouseY-pointY < 12 && mouseY-pointY > -12)) {
					var parent = this,
						dataset = {
						x: function (r) {return Math.round10((pointX-parent.middleX)/parent.unitsGapX,r*-1)},
						y: function (r) {return Math.round10(((pointY-parent.middleY)/parent.unitsGapY)*-1,r*-1)},
						formula: this.functions[i].formula
					}
					this.updateGraths();
					this.ctx.beginPath();
	    			this.ctx.fillStyle = this.functions[i].color;
					this.ctx.arc(pointX,pointY,3,0,2*Math.PI);
					this.ctx.fill(); 

					if (this.canvasWidth - pointX < 160) {
						pointX -= 160;
					} else {
						pointX += 5;
					}
					if (pointY < 90) {
						pointY += 5;
					} else {
						pointY -= 85;
					}

					this.ctx.shadowBlur=2;
					this.ctx.shadowColor="black";
					this.ctx.fillStyle = this.functions[i].color;

					if (this.options.toopTips.roundEdges) {
						this.ctx.roundRect(pointX, pointY, 150, this.functionsComp.length*35+5, 5, true, false);
					} else {
						this.ctx.fillRect(pointX, pointY, 150 , this.functionsComp.length*35+5);
					}

					this.ctx.shadowBlur=0;
					this.ctx.fillStyle = this.options.toopTips.fontColor;
					this.ctx.font = "30px " + this.options.fontType;
					for (var i3 = 0; i3 < this.functionsComp.length; i3++) {
						this.ctx.fillText(this.functionsComp[i3](dataset), pointX+5, pointY+25+i3*35, 140);
					}
					this.hoverMenu = true;
					return;
				} else {
					if (this.hoverMenu) {
						this.updateGraths();
						this.hoverMenu = false;
					}
				}
			}
		}
	}

	var doingResize = false,
		isInterval = 0,
		parent = this;
	if (this.options.toopTips.enable) {
		this.canvas.addEventListener("mousemove", function (event) {
			if (isInterval == 0 && !doingResize) {
				parent.updateHover(event);
				isInterval += 1;
			    window.setTimeout(function() {
					isInterval -= 1;
				}, 50);
		    }
		});
	}

	if (this.options.changeOnResize) {
		window.onresize = function() {
			if (parent.canvasWidth != parent.options.size.width() || parent.canvasHeight != parent.options.size.height()) {
				doingResize = true;
				parent.canvasWidth = parent.canvas.width  = parent.options.size.width();
				parent.canvasHeight = parent.canvas.height = parent.options.size.height();
				parent.resizeGraths();
				doingResize = false;
			}
		}
	}

	return this.exports;
};
