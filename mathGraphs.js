/*!
 * mathGraphs
 * https://github.com/dr-gouglhupf/mathGraphs/
 * Version: 0.1-alpha
 *
 * Copyright 2015 Justus Leiner
 * Released under the MIT license
 * https://github.com/dr-gouglhupf/mathGraphs/blob/master/LICENSE.md
 */

var graph = function (context, settings){
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
			referenceLines: true,
			text: true
		},
		toolTips: {
			enable: true,
			roundEdges: true,
			width: 140,
			fontColor: "#e3f2fd",
			template: "P(<x(1)>, <y(1)>)<br>f(x) = <formula>"
		},
		fontType: "Arial",
		changeOnResize: true,
		randomColors: true,
		moveEnable: true,
		zoomEnable: true,
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
	this.offset = {x: 0, y: 0};
	this.zoom = 0;

	this.options = helpers.merge(defaultConfig, settings);
	this.functionsComp = helpers.complileTemplate(this.options.toolTips.template);

	this.canvasWidth = this.canvas.width  = this.options.size.width();
	this.canvasHeight = this.canvas.height = this.options.size.height();

	this.dynamicZoom = (this.options.gridSettings.range.xM*-1+this.options.gridSettings.range.xP+1 == 
						this.options.gridSettings.range.yM*-1+this.options.gridSettings.range.yP+1);

	if(!this.dynamicZoom) console.warn("Dynamic zoom was turned off due to the fact that the scale is stretched!");

	this.drawGrid = function() {
		// First reset the canvas
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); 

		// All essential variables such as spacing, number of units considering the offset and so on
		var canvasWidth = this.canvasWidth = this.canvas.width,
			canvasHeight = this.canvasHeight = this.canvas.height,
			range = {
				xM: this.options.gridSettings.range.xM+this.zoom,
				xP: this.options.gridSettings.range.xP-this.zoom,
				yM: this.options.gridSettings.range.yM+this.zoom,
				yP: this.options.gridSettings.range.yP-this.zoom
			},
			unitsX = range.xM*-1+range.xP+1,
			unitsY = range.yM*-1+range.yP+1,
			unitsGapX = canvasWidth / unitsX,
			unitsGapY = canvasHeight / unitsY,
			middleX = canvasWidth/2,
			middleY = canvasHeight/2,
			offsetX = this.offset.x/unitsGapX,
			offsetY = this.offset.y*-1/unitsGapY,
			titlePosX = (this.offset.x > canvasWidth/2) ? 0 : (this.offset.x*-1 > canvasWidth/2) ? canvasWidth : middleX-this.offset.x,
			titlePosY = (this.offset.y > canvasHeight/2) ? 0 : (this.offset.y*-1 > canvasHeight/2) ? canvasHeight : middleY-this.offset.y,
			increment = 1;

		if (this.dynamicZoom) increment = this.getIncrement(unitsX);

		// Saves default and restores them if already initialized

		if (this.initialized) this.ctx.restore();

		this.ctx.save();

		// Draws middel line if they should be on the canvas


		// Draws reference lines

		if (this.options.gridSettings.referenceLines) {
			for (var i = (this.offset.x > middleX) ? Math.floor(offsetX-range.xP) : increment; i <= range.xP+Math.floor(offsetX+0.5); i += increment) {
				this.drawRefLinieX(unitsGapX*i+middleX-this.offset.x);
			};
			for (var i = (this.offset.y*-1 > middleY) ? Math.floor(offsetY-range.yP) : increment; i <= range.yP+Math.floor(offsetY+0.5); i += increment) {
				this.drawRefLinieY(canvasHeight-(unitsGapY*i+middleY+this.offset.y));
			};
			for (var i = (this.offset.x*-1 > middleX) ? Math.ceil(offsetX-range.xM) : increment*-1; i >= range.xM+Math.floor(offsetX); i -= increment) {
				this.drawRefLinieX(unitsGapX*i+middleX-this.offset.x);
			};
			for (var i = (this.offset.y > middleY) ? Math.ceil(offsetY-range.yM) : increment*-1; i >= range.yM+Math.floor(offsetY); i -= increment) {
				this.drawRefLinieY(canvasHeight-(unitsGapY*i+middleY+this.offset.y));
			};
		}

		this.ctx.lineWidth = 2;
		this.ctx.strokeStyle = "#7f8c8d";
		if (this.offset.y < canvasHeight/2 && this.offset.y*-1 < canvasHeight/2) {
			this.ctx.beginPath();
			this.ctx.moveTo(0, middleY-this.offset.y);
			this.ctx.lineTo(canvasWidth, middleY-this.offset.y);
			this.ctx.stroke();
		}
		if (this.offset.x < canvasWidth/2 && this.offset.x*-1 < canvasWidth/2) {
			this.ctx.beginPath();
			this.ctx.moveTo(middleX-this.offset.x, 0);
			this.ctx.lineTo(middleX-this.offset.x, canvasHeight);
			this.ctx.stroke();
		}

		// Draws the text for the units

		for (var i = (this.offset.x > middleX) ? Math.floor(offsetX-range.xP) : increment; i <= range.xP+Math.floor(offsetX+0.5); i += increment) {
			this.drawUnitX(unitsGapX*i+middleX-this.offset.x, titlePosY, i, (this.offset.y+20 < canvasHeight/2) ? -10 : 20);
		};
		for (var i = (this.offset.y*-1 > middleY) ? Math.floor(offsetY-range.yP) : increment; i <= range.yP+Math.floor(offsetY+0.5); i += increment) {
			this.drawUnitY(titlePosX,canvasHeight-(unitsGapY*i+middleY+this.offset.y), i, (this.offset.x*-1+20 > canvasWidth/2) ? -10 : 10);
		};
		for (var i = (this.offset.x*-1 > middleX) ? Math.ceil(offsetX-range.xM) : increment*-1; i >= range.xM+Math.floor(offsetX); i -= increment) {
			this.drawUnitX(unitsGapX*i+middleX-this.offset.x, titlePosY, i, (this.offset.y+20 < canvasHeight/2) ? -10 : 20);
		};
		for (var i = (this.offset.y > middleY) ? Math.ceil(offsetY-range.yM) : increment*-1; i >= range.yM+Math.floor(offsetY); i -= increment) {
			this.drawUnitY(titlePosX,canvasHeight-(unitsGapY*i+middleY+this.offset.y), i, (this.offset.x*-1+20 > canvasWidth/2) ? -10 : 10);
		};

		// Makes a few variables public to the script

		this.initialized = true;
		this.middleX = middleX;
		this.middleY = middleY;
		this.unitsGapX = unitsGapX;
		this.unitsGapY = unitsGapY;
	}

	this.getIncrement = function (units, increment) {
		if (typeof increment === "undefined") var increment = 1;
		if (units/increment > 35) increment = this.getIncrement(units, increment+1);

		return increment;
	}

	this.drawRefLinieX = function (x) {
		this.ctx.lineWidth = 2;
		this.ctx.strokeStyle = this.options.gridSettings.colors.axes;
		this.ctx.beginPath();
		this.ctx.moveTo(x, 0);
		this.ctx.lineTo(x, this.canvasHeight);
		this.ctx.stroke();
	}

	this.drawRefLinieY = function (y) {
		this.ctx.lineWidth = 2;
		this.ctx.strokeStyle = this.options.gridSettings.colors.axes;
		this.ctx.beginPath();
		this.ctx.moveTo(0, y);
		this.ctx.lineTo(this.canvasWidth, y);
		this.ctx.stroke();
	}

	// Draws the background lines, the text for the units and the "small little" lines along the X-axis
	this.drawUnitX = function(posX, posY, title, textOffset) {
		this.ctx.lineWidth = 2;
		this.ctx.strokeStyle = this.options.gridSettings.colors.temLines;
		this.ctx.beginPath();
		this.ctx.moveTo(posX, posY - 5);
		this.ctx.lineTo(posX, posY + 5);
		this.ctx.stroke();
		if (this.options.gridSettings.text) {
			this.ctx.textAlign = "left";
			this.ctx.font="14px " + this.options.fontType;
			this.ctx.fillStyle = this.options.gridSettings.colors.text;
			this.ctx.fillText(title,posX-this.ctx.measureText(title.toString()).width/2,posY + textOffset);
		}
	}

	// Same but along the Y-axis
	this.drawUnitY = function(posX, posY, title, textOffset) {
		this.ctx.lineWidth = 2;
		this.ctx.strokeStyle = this.options.gridSettings.colors.temLines;
		this.ctx.beginPath();
		this.ctx.moveTo(posX - 5, posY);
		this.ctx.lineTo(posX + 5, posY);
		this.ctx.stroke();
		if (this.options.gridSettings.text) {
			this.ctx.textAlign = (textOffset < 0) ? "right" : "left";
			this.ctx.font="14px " + this.options.fontType;
			this.ctx.fillStyle = this.options.gridSettings.colors.text;
			this.ctx.fillText(title,posX + textOffset,posY+5);
		}
	}

	// This is the heart of the script. It calculates a graph and saves the points the an array which is then returned
	this.funGraph = function (funcStr, color) {
		var xx, yy, xN, yN, previous = {x: 0, y: 0}, dx=4, points=[], 
			middleX = this.middleX, 
			middleY = this.middleY,
			iMax = Math.round((this.canvasWidth-middleX)/dx),
			iMin = Math.round(-middleX/dx),
			func = math.compile(funcStr);

		this.ctx.beginPath();
		this.ctx.lineWidth = 2;
		this.ctx.strokeStyle = color;
		for (var i = iMin; i <= iMax; i++) {
			xx = dx * i; yy = this.unitsGapY * func.eval({x: xx/this.unitsGapX});
			if (middleY - yy >= 0) {
				if (previous.y > yy && middleY - previous.y < 0) {
					points.push({x: middleX + previous.x, y: middleY-previous.y});
					this.ctx.moveTo(middleX + previous.x - this.offset.x, middleY - previous.y - this.offset.y);
				}
				points.push({x: middleX + xx, y: middleY-yy});
				this.ctx.lineTo(middleX + xx - this.offset.x,middleY-yy - this.offset.y);
			} else if (i != iMin && previous.y < yy && middleY - previous.y > 0) {
				xN = xx + dx, yN = this.unitsGapY * func.eval({x: xN/this.unitsGapX});
				this.ctx.lineTo(middleX + xN - this.offset.x,middleY-yN - this.offset.y);
				points.push({x: middleX + xN, y: middleY - yN});
				break;
			}
			previous = {x: xx, y: yy};
		}
		this.ctx.stroke();

		return {
			compFunction: func,
			points: points
		};
	}

	// This function initializes a complete new canvas-space with given functions
	this.drawGraphs = function (graphFuncs) {
		this.drawGrid();

		this.functions = [];

		var graphReturn;

		for(var i = 0; i < graphFuncs.length; i++) {
			this.functions.push({formula: graphFuncs[i]});
			try {
				if (this.options.randomColors) {
					this.functions[i].color = this.options.colors[Math.round(helpers.getRandomArbitrary(0, this.options.colors.length-1))];
					graphReturn = this.funGraph(graphFuncs[i],this.functions[i].color);
					this.functions[i].points = graphReturn.points;
					this.functions[i].compiled = graphReturn.compFunction;
				} else {
					this.functions[i].color = this.options.colors[i];
					graphReturn = this.funGraph(graphFuncs[i],this.options.colors[i]);
					this.functions[i].points = graphReturn.points;
					this.functions[i].compiled = graphReturn.compFunction;
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

	// This adds given functions to the canvas-space without removing the old ones
	this.addGraphs = function (graphFuncs) {
		if(!this.initialized) {
			this.drawGrid();
		}

		var graphReturn,
			prevLenght = this.functions.length;

		for (var i = 0; i < graphFuncs.length; i++) {
			this.functions.push({formula: graphFuncs[i]});
		}

		for (var i = 0; i < graphFuncs.length; i++) {
			try {
				if (this.options.randomColors) {
					this.functions[i+prevLenght].color = this.options.colors[Math.round(helpers.getRandomArbitrary(0, this.options.colors.length-1))];
					graphReturn = this.funGraph(graphFuncs[i], this.functions[i+prevLenght].color);
					this.functions[i+prevLenght].points = graphReturn.points;
					this.functions[i+prevLenght].compiled = graphReturn.compFunction;
				} else {
					this.functions[i+prevLenght].color = this.options.colors[i+prevLenght];
					graphReturn = this.funGraph(graphFuncs[i],this.options.colors[i+prevLenght]);
					this.functions[i+prevLenght].points = graphReturn.points;
					this.functions[i+prevLenght].compiled = graphReturn.compFunction;
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

	// Calculate missing points
	this.addMissingPoints = function () {
		var pointsAry, pointX, pointY, xx, yy;

		for (var i = 0; i < this.functions.length; i++) {
			pointsAry = this.functions[i].points;
			if (pointsAry[0].x-this.offset.x > 0 && pointsAry[0].x-this.offset.x < this.canvasWidth && 
				pointsAry[0].y-this.offset.y > 0 && pointsAry[0].y-this.offset.y < this.canvasHeight) {
				this.ctx.beginPath();
				this.ctx.lineWidth = 2;
				this.ctx.strokeStyle = this.functions[i].color;
				this.ctx.moveTo(pointsAry[0].x-this.offset.x,pointsAry[0].y-this.offset.y);

				while (pointsAry[0].x-this.offset.x > 0 && pointsAry[0].x-this.offset.x < this.canvasWidth && 
					pointsAry[0].y-this.offset.y > 0 && pointsAry[0].y-this.offset.y < this.canvasHeight) {
					xx = pointsAry[0].x-this.middleX-4;
					yy = this.unitsGapY*this.functions[i].compiled.eval({x: xx/this.unitsGapX});

					this.ctx.lineTo(this.middleX+xx-this.offset.x,this.middleY-yy-this.offset.y);

					pointsAry.unshift({x: this.middleX+xx, y: this.middleY-yy});
				}

				this.ctx.stroke();
			}
			if (pointsAry[pointsAry.length-1].x-this.offset.x > 0 && pointsAry[pointsAry.length-1].x-this.offset.x < this.canvasWidth && 
				pointsAry[pointsAry.length-1].y-this.offset.y > 0 && pointsAry[pointsAry.length-1].y-this.offset.y < this.canvasHeight) {
				this.ctx.beginPath();
				this.ctx.lineWidth = 2;
				this.ctx.strokeStyle = this.functions[i].color;
				this.ctx.moveTo(pointsAry[pointsAry.length-1].x-this.offset.x,pointsAry[pointsAry.length-1].y-this.offset.y);

				while (pointsAry[pointsAry.length-1].x-this.offset.x > 0 && pointsAry[pointsAry.length-1].x-this.offset.x < this.canvasWidth && 
					pointsAry[pointsAry.length-1].y-this.offset.y > 0 && pointsAry[pointsAry.length-1].y-this.offset.y < this.canvasHeight) {
					xx = pointsAry[pointsAry.length-1].x-this.middleX+4;
					yy = this.unitsGapY*this.functions[i].compiled.eval({x: xx/this.unitsGapX});

					this.ctx.lineTo(this.middleX+xx-this.offset.x,this.middleY-yy-this.offset.y);

					pointsAry.push({x: this.middleX+xx, y: this.middleY-yy});
				}

				this.ctx.stroke();
			}
		}
	}

	// Updates the canvas by using the calculated points
	this.updateGraphs = function () {
		this.drawGrid();

		for(var i = 0; i < this.functions.length; i++) {
			var pointsAry = this.functions[i].points;
			this.ctx.beginPath();
			this.ctx.lineWidth = 2;
			this.ctx.strokeStyle = this.functions[i].color;
			this.ctx.moveTo(pointsAry[0].x-this.offset.x,pointsAry[0].y-this.offset.y);
			for(var i2 = 1; i2 < pointsAry.length; i2++) {
				this.ctx.lineTo(pointsAry[i2].x-this.offset.x,pointsAry[i2].y-this.offset.y);
			}
			this.ctx.stroke();
		}
	}

	// This is called the mouse cursor moves on or in the canvas
	this.updateHover = function (e) {
		e.preventDefault();
		e.stopPropagation();
		var mouseX=parseInt(e.clientX-this.canvas.offsetLeft),
			mouseY=parseInt(e.clientY-this.canvas.offsetTop);

		var pointX, pointY, pointsAry;
		for (var i = 0; i < this.functions.length; i++) {
			pointsAry = this.functions[i].points;
			for (var i2 = 0; i2 < pointsAry.length; i2++) {
				pointX = pointsAry[i2].x-this.offset.x; 
				pointY = pointsAry[i2].y-this.offset.y;
				if (mouseX-pointX < 12 && mouseX-pointX > -12 && (mouseY-pointY < 12 && mouseY-pointY > -12)) {
					var parent = this,
						dataset = {
						x: function (r) {return Math.round10((pointsAry[i2].x-parent.middleX)/parent.unitsGapX,r*-1)},
						y: function (r) {return Math.round10((pointsAry[i2].y-parent.middleY)/parent.unitsGapY*-1,r*-1)},
						formula: this.functions[i].formula
					}
					this.updateGraphs();

					this.ctx.restore();

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

					if (this.options.toolTips.roundEdges) {
						this.ctx.roundRect(pointX, pointY, 150, this.functionsComp.length*35+5, 5, true, false);
					} else {
						this.ctx.fillRect(pointX, pointY, 150 , this.functionsComp.length*35+5);
					}

					this.ctx.shadowBlur=0;
					this.ctx.fillStyle = this.options.toolTips.fontColor;
					this.ctx.font = "30px " + this.options.fontType;
					for (var i3 = 0; i3 < this.functionsComp.length; i3++) {
						this.ctx.fillText(this.functionsComp[i3](dataset), pointX+5, pointY+25+i3*35, 140);
					}
					this.hoverMenu = true;
					return;
				} else {
					if (this.hoverMenu) {
						this.updateGraphs();
						this.hoverMenu = false;
					}
				}
			}
		}
	}

	// Called then the mouse cursor moves and the mouse button is clicked
	this.updateOffset = function (e, mouseState) {
		// Update offset

		if (e !== "undefined" && mouseState !== "undefined") {
			this.offset.x = parseInt(mouseState.mouseX - (e.clientX-this.canvas.offsetLeft));
			this.offset.y = parseInt(mouseState.mouseY - (e.clientY-this.canvas.offsetTop));
		}

		this.updateGraphs();

		this.addMissingPoints();
	}

	// Zoom...
	this.updateZoom = function (e) {
		// cross-browser wheel delta
		var e = window.event || e; // old IE support

		if (this.dynamicZoom) {
			// TODO

			this.zoom += Math.max(-1, Math.min(1, (e.wheelDelta || -e.detail)));
		} else this.zoom += Math.max(-1, Math.min(1, (e.wheelDelta || -e.detail)));

		if (this.options.gridSettings.range.xM+this.zoom > -1 || this.options.gridSettings.range.xP-this.zoom < 1 ||
			this.options.gridSettings.range.yM+this.zoom > -1 || this.options.gridSettings.range.yP-this.zoom < 1) {
			this.zoom -= 1;
			return;
		}

		this.drawGrid();

		var graphReturn;

		for(var i = 0; i < this.functions.length; i++) {
			graphReturn = this.funGraph(this.functions[i].formula, this.functions[i].color);
			this.functions[i].points = graphReturn.points;
			this.functions[i].compiled = graphReturn.compFunction;
		}

		this.addMissingPoints();
	}

	// This is called then the window resizes
	this.resizeGraphs = function () {
		this.drawGrid();

		var graphReturn;

		for(var i = 0; i < this.functions.length; i++) {
			graphReturn = this.funGraph(this.functions[i].formula, this.functions[i].color);
			this.functions[i].points = graphReturn.points;
			this.functions[i].compiled = graphReturn.compFunction;
		}
		
		this.addMissingPoints();
	}


	// Initializes the hover and scrolling

	var doingResize = false,
		isInterval = 0,
		parent = this;
		parent.mouseState = {};
	if (this.options.toolTips.enable || this.options.moveEnable) {
		this.canvas.addEventListener("mousemove", function (event) {
			if (isInterval == 0 && !doingResize) {
				if (parent.options.moveEnable && parent.mouseState.down) {
					parent.updateOffset(event, parent.mouseState);
				}
				else if (parent.options.toolTips.enable) {
					parent.updateHover(event);
				}
				isInterval += 1;
				window.setTimeout(function() {
					isInterval -= 1;
				}, 33);
			}
		});
	}

	if (this.options.moveEnable) {
		this.canvas.addEventListener("mousedown", function (event) {
			parent.mouseState = {
				down: true,
				mouseX: parseInt(event.clientX-parent.canvas.offsetLeft) + parent.offset.x,
				mouseY: parseInt(event.clientY-parent.canvas.offsetTop) + parent.offset.y
			}
			parent.canvas.style.cursor = "move";
		});
		this.canvas.addEventListener("mouseup", function () {
			parent.canvas.style.cursor = "auto";
			parent.mouseState.down = false;
		});
		this.canvas.addEventListener("mouseout", function () {
			parent.canvas.style.cursor = "auto";
			parent.mouseState.down = false;
		});
	}

	if (this.options.zoomEnable) {
		// Firefox
		this.canvas.addEventListener("DOMMouseScroll", function (event) {
			parent.updateZoom(event);
			event = event || window.event;
			if (event.preventDefault)
				event.preventDefault();
			event.returnValue = false;
		}, false);

		// IE9, Chrome, Safari, Opera
		this.canvas.addEventListener("mousewheel", function (event) {
			parent.updateZoom(event);
			event = event || window.event;
			if (event.preventDefault)
				event.preventDefault();
			event.returnValue = false;
		}, false);

		this.canvas.addEventListener("mouseover", function () {
			//parent.disableScroll();
		}, false);
	}

	if (this.options.changeOnResize) {
		window.onresize = function() {
			if (parent.canvasWidth != parent.options.size.width() || parent.canvasHeight != parent.options.size.height()) {
				doingResize = true;
				parent.canvasWidth = parent.canvas.width  = parent.options.size.width();
				parent.canvasHeight = parent.canvas.height = parent.options.size.height();
				parent.resizeGraphs();
				doingResize = false;
			}
		}
	}

	return this;
};
