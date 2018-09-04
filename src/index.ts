import * as $ from "jquery";
import * as d3 from "d3";


const fontFamily: string = "\"Lucida Sans Unicode\", \"Lucida Sans Grande\", \"Trebuchet MS\", Tahoma, Arial, Helvetica, sans-serif";


export interface GraphData {
    nodes: Node[];
    links: Link[];
}


export interface Link extends d3.SimulationLinkDatum<Node> { 
    id: string;
    value?: number;
}


export interface Node extends d3.SimulationNodeDatum { 
    id: string;
    color?: string;
    count?: number;
    radius?: number;
}


export interface Selection<T> extends d3.Selection<d3.BaseType, T, d3.BaseType, {}> { }


export interface Simulation extends d3.Simulation<Node, Link> { }


let width: number = 800;
let height: number = 600;
let data: GraphData = {
    nodes: [],
    links: []
};


function createLinks():void {
    let countOfLinks = 20;
    for (let i = 0; i < countOfLinks; i++) {
        let sourceIndex = 0;
        let targetIndex = 0;
        do {
            sourceIndex = rand(0, data.nodes.length);
            targetIndex = rand(0, data.nodes.length);
        } while (sourceIndex === targetIndex);
        let link = <Link>{
            id: (i + 1).toFixed(0),
            source: data.nodes[sourceIndex],
            target: data.nodes[targetIndex]
        };
        data.links.push(link);
    }
}


function createNodes(): void {
    let countOfNodes = 12;
    for (let i = 0; i < countOfNodes; i++) {
        let node = <Node>{
            id: (i + 1).toFixed(0),
            color: d3.interpolateRainbow(i / countOfNodes),
            radius: 5
        };
        data.nodes.push(node);
    }
}


function createDrawing(graph: GraphData): Simulation {
    d3.select("html")
        .style("height", "100%");

    let div = d3.select("body")
        .style("height", "100%")
        .style("min-height", "100%")
        .style("margin", "0")
        .style("font-family", fontFamily)
        .style("font-size", "12px")
        .append("div")
        .classed("container", true)
        .style("width", "90%")
        .style("min-height", "100%")
        .style("margin", "0 auto");
    
    let dimensions = getDimensions(div);
    width = 1.0 * dimensions.width;
    height = 0.9 * dimensions.height;

    let svg = div.append("svg")
        .attr("width", width)
        .attr("height", height);
    
    drawControls(div, svg, graph);
    
    let simulation = drawFDG(svg, graph);
    return simulation;
}


function createSimulation(nodes: Node[], width: number, height: number): Simulation {
    return d3.forceSimulation(nodes)
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("charge", d3.forceManyBody())
        .force("link", d3.forceLink().id(getNodeId));
}


function drawControls(container: d3.Selection<d3.BaseType, {}, d3.BaseType, {}>, svg: Selection<{}>, graph: GraphData): void {
    let row = container.append("div")
        .style("display", "block");

    row.append("div")
        .style("display", "inline-block")
        .style("width", "25%")
        .append("label")
        .text("Node");

    let nodeOptions: Node[] = [{ id: "N/A" }];
    graph.nodes.forEach(node => { nodeOptions.push(node); });
    row.append("div")
        .style("display", "inline-block")
        .style("width", "25%")
        .append("select")
        .attr("id", "select-node")
        .classed("user-input", true)
        .style("width", "90%")
        .style("padding", "3px")
        .selectAll("option")
        .data(nodeOptions)
        .enter()
        .append("option")
        .text(d => d.id);

    row.append("div")
        .style("display", "inline-block")
        .style("width", "25%")
        .append("label")
        .text("Degrees of Freedom");

    let dfOptions = ["N/A", "0", "1", "2", "3"];
    row.append("div")
        .style("display", "inline-block")
        .style("width", "25%")
        .append("select")
        .attr("id", "select-df")
        .classed("user-input", true)
        .style("width", "90%")
        .style("padding", "3px")
        .selectAll("option")
        .data(dfOptions)
        .enter()
        .append("option")
        .text(d => d);

    $(".user-input").on("change", () => {
        let selectedNode = $("#select-node").val();
        let selectedDF = +getNumericValue("#select-df");
        // console.log("node:", selectedNode, ", df:", selectedDF);
        
        let data: GraphData = {
            nodes: [],
            links: []
        };

        if (selectedNode === "N/A") {
            data.nodes = graph.nodes;
            data.links = graph.links;
        }
        else {
            if (isNaN(selectedDF)) {
                selectedDF = graph.nodes.length;
            }
            data.nodes = graph.nodes.filter(n => n.id === selectedNode);
            data.links = [];

            for (let i = 0; i < selectedDF; i++) {
                data.links = graph.links
                    .filter(filterLinks(data.nodes))
                    .reduce(reduceUniqueLinks(), []);
                data.nodes = graph.nodes
                    .filter(filterNodes(data.links))
                    .reduce(reduceUniqueNodes(), []);
            }
        }
        drawFDG(svg, data);
    });
}


function drawFDG(svg: Selection<{}>, graph: GraphData): Simulation {
    svg.selectAll("*").remove();

    let simulation = createSimulation(graph.nodes, width, height);
    updateSimulationLinks(simulation, graph.links);

    let links = drawLinks(svg, graph.links);
    let nodes = drawNodes(svg, graph.nodes);
    let titles = drawTitles(svg, graph.nodes);

    simulation.on("tick", () => {
        updateLinkPosition(links);
        updateNodePosition(nodes);
        updateTitlePosition(titles);
    });

    return simulation;
}


function drawLinks(container: Selection<{}>, links: Link[]): Selection<Link> {
    return container.append("g")
        .classed("links", true)
        .selectAll("line.link")
        .data(links)
        .enter()
        .append("line")
        .classed("link", true)
        .attr("stroke-width", 1)
        .attr("stroke", "#999")
        .attr("stroke-opacity", 0.6)
        .attr("x1", d => getNodeX(d.source))
        .attr("y1", d => getNodeY(d.source))
        .attr("x2", d => getNodeX(d.target))
        .attr("y2", d => getNodeY(d.target));
}


function drawNodes(container: Selection<{}>, nodes: Node[]): Selection<Node> {
    return container.append("g")
        .classed("nodes", true)
        .selectAll("circle.node")
        .data(nodes)
        .enter()
        .append("circle")
        .classed("node", true)
        .attr("data-id", d => d.id)
        .attr("cx", d => (d.x) ? d.x : 0)
        .attr("cy", d => (d.y) ? d.y : 0)
        .attr("r", d => (d.radius) ? d.radius : 0)
        .attr("fill", d => (d.color) ? d.color : "#000");
}


function drawTitles(container: Selection<{}>, nodes: Node[]): Selection<Node> {
    return container.append("g")
        .classed("titles", true)
        .selectAll("text.title")
        .data(nodes)
        .enter()
        .append("text")
        .classed("title", true)
        .attr("font-size", 10)
        .attr("font-family", fontFamily)
        .attr("dx", 6)
        .attr("dy", 6)
        .text(d => d.id);
}


function filterLinks(nodes: Node[]): (link: Link) => boolean {
    return (link: Link) => {
        for (let i = 0; i < nodes.length; i++) {
            if (hasNode(link, nodes[i])) {
                return true;
            }
        }
        return false;
    };
}


function filterNodes(links: Link[]): (node: Node) => boolean {
    return (node: Node) => {
        for (let i = 0; i < links.length; i++) {
            if (hasNode(links[i], node)) {
                return true;
            }
        }
        return false;
    };
}


function getDimensions(selection: Selection<{}>): ClientRect {
    let node: d3.BaseType = selection.node();
    if (node) {
        let element = <Element>node;
        return element.getBoundingClientRect();
    }
    return new ClientRect();
}


function getNodeId(item: any): string {
    let node = <Node>item;
    return node.id;
}


function getNodeX(item: any): number {
    let node = <Node>item;
    return node.x ? node.x : 0;
}


function getNodeY(item: any): number {
    let node = <Node>item;
    return node.y ? node.y : 0;
}


function hasNode(link: Link, node: Node): boolean {
    let sourceId: string = (<Node>link.source).id;
    let targetId: string = (<Node>link.target).id;
    return sourceId === node.id || targetId === node.id;
}


function getNumericValue(selector: string): number {
    let value: any = $(selector).val();
    return (value) ? +value : 0;
}


function rand(min: number, max: number): number {
    let randomValue = min + (max - min) * Math.random();
    return Math.floor(randomValue);
}


function reduceUniqueLinks(): (previous: Link[], current: Link) => Link[] {
    return (previous: Link[], current: Link) => {
        let linkIds = previous.map(d => d.id);
        if (linkIds.indexOf(current.id) === -1) {
            previous.push(current);
        }
        return previous;
    };
}


function reduceUniqueNodes(): (previous: Node[], current: Node) => Node[] {
    return (previous: Node[], current: Node) => {
        let linkIds = previous.map(d => d.id);
        if (linkIds.indexOf(current.id) === -1) {
            previous.push(current);
        }
        return previous;
    };
}


function updateLinkPosition(links: Selection<Link>): Selection<Link> {
    return links.attr("x1", d => getNodeX(d.source))
        .attr("y1", d => getNodeY(d.source))
        .attr("x2", d => getNodeX(d.target))
        .attr("y2", d => getNodeY(d.target));
}


function updateNodePosition(nodes: Selection<Node>): Selection<Node> {
    return nodes.attr("cx", d => (d.x) ? d.x : 0)
        .attr("cy", d => (d.y) ? d.y: 0);
}


function updateSimulationLinks(simulation: Simulation, links: Link[]): void {
    let force = simulation.force("link");
    let linkForce = <d3.ForceLink<Node, Link>>force;
    linkForce.links(links);
}


function updateTitlePosition(titles: Selection<Node>): Selection<Node> {
    return titles.attr("x", d => (d.x) ? d.x : 0)
        .attr("y", d => (d.y) ? d.y : 0);
}


createNodes();
createLinks();
createDrawing(data);
