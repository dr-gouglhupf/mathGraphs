import { graph } from './math-graphs-lib.js'

// First make a new instance
const graph1 = new graph(document.getElementById("canvas").getContext("2d"), {});

// Draw some new functions form scratch
graph1.drawGraphs(["x^2","2*x"]);

// Add some new ones to the canvas
graph1.addGraphs(["x^2+3*x-6","-(1/2)*x","x"]);
