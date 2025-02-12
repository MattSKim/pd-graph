import * as d3 from 'd3';

// Function to read and parse the CSV file
async function loadData() {
    try {
        const url = new URL('/data/Clinical_Manifestations_Cross_Table.csv', window.location.href);
        const data = await d3.csv(url.href);
        return data;
    } catch (error) {
        console.error('Error loading the CSV file:', error);
        return null;
    }
}

// Function to process data and create graph structure
function createGraphData(tableData) {
    const nodes = new Set();
    const links = [];
    
    // Get column headers and row headers
    const columnHeaders = Object.keys(tableData[0]);
    const rowHeaders = tableData.map(row => row[columnHeaders[0]]); // Assuming first column contains row headers
    
    // Add all headers to nodes
    columnHeaders.forEach(header => nodes.add(header));
    rowHeaders.forEach(header => nodes.add(header));
    
    // Process each row to create links only between column and row headers
    tableData.forEach(row => {
        const rowHeader = row[columnHeaders[0]]; // Get the row header
        
        // Start from index 1 to skip the row header column
        columnHeaders.slice(1).forEach(columnHeader => {
            if (row[columnHeader]) { // If there's a value in this cell
                links.push({
                    source: rowHeader,
                    target: columnHeader,
                    value: `${rowHeader} - ${row[columnHeader]}`
                });
            }
        });
    });

    return {
        nodes: Array.from(nodes).map(id => ({ id })),
        links: links
    };
}

// Function to create and update the visualization
function createVisualization(graphData) {
    const width = document.getElementById('graph').clientWidth;
    const height = document.getElementById('graph').clientHeight;

    const svg = d3.select('#graph')
        .append('svg')
        .attr('width', width)
        .attr('height', height);

    // Add zoom functionality
    const g = svg.append('g');
    const zoom = d3.zoom()
        .scaleExtent([0.1, 4])  // Set min/max zoom scale
        .on('zoom', (event) => {
            g.attr('transform', event.transform);
        });

    svg.call(zoom);
    
    // Create force simulation
    const simulation = d3.forceSimulation(graphData.nodes)
        .force('link', d3.forceLink(graphData.links).id(d => d.id))
        .force('charge', d3.forceManyBody().strength(-300))
        .force('center', d3.forceCenter(width / 2, height / 2));

    // Create links
    const link = g.append('g')  // Changed from svg.append to g.append
        .selectAll('g')
        .data(graphData.links)
        .join('g')
        .attr('class', 'link-group');

    // Add the visible link
    link.append('line')
        .attr('class', 'link');

    // Add the invisible wider line for hit detection
    link.append('line')
        .attr('class', 'link-hitbox')
        .on('mouseover', showLinkInfo)
        .on('mouseout', hideInfo);

    // Create nodes
    const node = g.append('g')  // Changed from svg.append to g.append
        .selectAll('.node')
        .data(graphData.nodes)
        .join('g')
        .attr('class', 'node')
        .call(d3.drag()
            .on('start', dragstarted)
            .on('drag', dragged)
            .on('end', dragended));

    node.append('circle')
        .attr('r', 10)
        .on('mouseover', showNodeInfo)
        .on('mouseout', hideInfo);

    node.append('text')
        .text(d => d.id)
        .attr('x', 15)
        .attr('y', 5);

    // Update positions on simulation tick
    simulation.on('tick', () => {
        // Update both the visible link and hitbox
        link.selectAll('line')
            .attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);

        node.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    // Drag functions
    function dragstarted(event, d) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = event.x;
        d.fy = event.y;
    }

    function dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    }

    function dragended(event, d) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    }
}

// Information panel update functions
function showNodeInfo(event, d) {
    const infoContent = document.getElementById('info-content');
    infoContent.innerHTML = `
        <h4>Node Information</h4>
        <p>${d.id}</p>
    `;
}

function showLinkInfo(event, d) {
    const infoContent = document.getElementById('info-content');
    infoContent.innerHTML = `
        <h4>Edge Information</h4>
        <p>From: ${d.source.id}</p>
        <p>To: ${d.target.id}</p>
        <p>Related Information: ${d.value}</p>
    `;
}

function hideInfo() {
    const infoContent = document.getElementById('info-content');
    infoContent.innerHTML = 'Hover over nodes or edges to see information';
}

// Initialize the visualization
async function init() {
    const tableData = await loadData();
    if (tableData) {
        const graphData = createGraphData(tableData);
        createVisualization(graphData);
    }
}

// Start the application
init(); 