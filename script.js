import * as d3 from 'd3';

// Function to read and parse the CSV files
async function loadData() {
    try {
        const manifestationsUrl = new URL('/data/Clinical_Manifestations_Cross_Table.csv', window.location.href);
        const categoriesUrl = new URL('/data/node_categories.csv', window.location.href);
        
        const [manifestationsData, categoriesData] = await Promise.all([
            d3.csv(manifestationsUrl.href),
            d3.csv(categoriesUrl.href)
        ]);

        // Add debugging logs
        console.log('Categories Data:', categoriesData);
        
        // Create a map of node categories
        const categoryMap = new Map(
            categoriesData.map(row => [row.Node.trim(), row.Category.trim()])
        );

        // Debug the category map
        console.log('Category Map:', Array.from(categoryMap.entries()));

        return {
            manifestationsData,
            categoryMap
        };
    } catch (error) {
        console.error('Error loading the CSV files:', error);
        return null;
    }
}

// Function to process data and create graph structure
function createGraphData(tableData, categoryMap) {
    const nodes = new Set();
    const links = [];
    
    // Get column headers and row headers
    const columnHeaders = Object.keys(tableData[0]);
    const rowHeaders = tableData.map(row => row[columnHeaders[0]]);
    
    // Add all headers to nodes
    columnHeaders.forEach(header => nodes.add(header));
    rowHeaders.forEach(header => nodes.add(header));
    
    // Debug the nodes
    console.log('All nodes:', Array.from(nodes));
    
    // Create nodes array with category information
    const nodesArray = Array.from(nodes).map(id => {
        // Try to find a matching node in the category map (case-insensitive)
        const matchingNode = Array.from(categoryMap.keys()).find(
            key => key.toLowerCase() === id.toLowerCase()
        );
        const category = matchingNode ? categoryMap.get(matchingNode) : 'Uncategorized';
        return { id, category };
    });

    // Debug the nodes with categories
    console.log('Nodes with categories:', nodesArray);

    // Process each row to create links
    tableData.forEach(row => {
        const rowHeader = row[columnHeaders[0]];
        columnHeaders.slice(1).forEach(columnHeader => {
            if (row[columnHeader]) {
                links.push({
                    source: rowHeader,
                    target: columnHeader,
                    value: `${rowHeader} - ${row[columnHeader]}`
                });
            }
        });
    });

    return {
        nodes: nodesArray,
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
    const link = g.append('g')
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
        .on('mouseover', (event, d) => {
            if (!selectedNode && !selectedLink) {
                showLinkInfo(event, d);
            }
        })
        .on('mouseout', (event, d) => {
            if (!selectedNode && !selectedLink) {
                hideInfo();
            }
        })
        .on('click', (event, d) => {
            // Deselect if clicking the same link
            if (selectedLink === d) {
                selectedLink = null;
                link.selectAll('line.link').classed('selected', false);
                hideInfo();
            } else {
                selectedLink = d;
                selectedNode = null;
                link.selectAll('line.link').classed('selected', false);
                d3.selectAll('.node circle').classed('selected', false);
                // Select both the hitbox's corresponding visible link
                d3.select(event.currentTarget.parentNode)
                    .select('line.link')
                    .classed('selected', true);
                showLinkInfo(event, d);
            }
            event.stopPropagation();
        });

    // Create nodes
    let selectedNode = null;
    let selectedLink = null;

    const node = g.append('g')
        .selectAll('.node')
        .data(graphData.nodes)
        .join('g')
        .attr('class', d => `node ${isManifestationNode(d) ? 'manifestation' : 'regular'}`)
        .call(d3.drag()
            .on('start', dragstarted)
            .on('drag', dragged)
            .on('end', dragended));

    node.append('circle')
        .attr('r', d => isManifestationNode(d) ? 15 : 10)
        .on('mouseover', (event, d) => {
            if (!selectedNode && !selectedLink) {
                showNodeInfo(event, d);
            }
        })
        .on('mouseout', (event, d) => {
            if (!selectedNode && !selectedLink) {
                hideInfo();
            }
        })
        .on('click', (event, d) => {
            // Deselect if clicking the same node
            if (selectedNode === d) {
                selectedNode = null;
                d3.selectAll('.node circle').classed('selected', false);
                hideInfo();
            } else {
                selectedNode = d;
                selectedLink = null;
                d3.selectAll('.node circle').classed('selected', false);
                d3.selectAll('.link').classed('selected', false);
                d3.select(event.currentTarget).classed('selected', true);
                showNodeInfo(event, d);
            }
            event.stopPropagation(); // Prevent svg click from triggering
        });

    node.append('text')
        .text(d => d.id)
        .attr('x', d => isManifestationNode(d) ? 20 : 15)  // Adjust text position for larger nodes
        .attr('y', 5);

    // Add click handler to svg to clear selection when clicking background
    svg.on('click', () => {
        selectedNode = null;
        selectedLink = null;
        d3.selectAll('.node circle').classed('selected', false);
        d3.selectAll('.link').classed('selected', false);
        hideInfo();
    });

    // Helper function to identify manifestation nodes
    function isManifestationNode(d) {
        return ['Hallucinations and psychosis', 'Depressed mood', 'Anxious mood', 
                'Apathy', 'Dopamine Dysregulation Syndrome', 'Sleep problems', 
                'Daytime sleepiness'].includes(d.id);
    }

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

    // Create filter panel and get active categories
    const nodeCategories = {};
    graphData.nodes.forEach(node => {
        if (node.category) {  // Only add if category exists
            nodeCategories[node.category.trim()] = true;
        }
    });

    // Debug the node categories before creating filter panel
    console.log('Node categories before filter panel:', nodeCategories);

    const activeCategories = createFilterPanel(nodeCategories);

    // Modify node and link visibility based on filters
    function updateVisibility() {
        node.style('display', d => activeCategories.has(d.category) ? null : 'none');
        
        link.style('display', d => {
            const sourceVisible = activeCategories.has(d.source.category);
            const targetVisible = activeCategories.has(d.target.category);
            return sourceVisible && targetVisible ? null : 'none';
        });
    }

    // Add event listeners to checkboxes
    document.querySelectorAll('#filter-panel input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                activeCategories.add(e.target.id);
            } else {
                activeCategories.delete(e.target.id);
            }
            updateVisibility();
        });
    });
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

// Add filter panel creation function
function createFilterPanel(categories) {
    // Debug the categories object
    console.log('Categories for filter panel:', categories);
    
    const filterPanel = document.createElement('div');
    filterPanel.id = 'filter-panel';
    filterPanel.innerHTML = `
        <h3>Filter Categories</h3>
        ${Object.keys(categories).map(category => `
            <div class="filter-option">
                <input type="checkbox" id="${category}" checked>
                <label for="${category}">${category}</label>
            </div>
        `).join('')}
        ${!categories['Uncategorized'] ? `
            <div class="filter-option">
                <input type="checkbox" id="Uncategorized" checked>
                <label for="Uncategorized">Uncategorized</label>
            </div>
        ` : ''}
    `;
    
    // Append to info-panel instead of body
    document.getElementById('info-panel').appendChild(filterPanel);

    // Return active categories
    const activeCategories = new Set(Object.keys(categories));
    if (!categories['Uncategorized']) {
        activeCategories.add('Uncategorized');
    }
    console.log('Active categories:', Array.from(activeCategories));
    return activeCategories;
}

// Initialize the visualization
async function init() {
    const data = await loadData();
    if (data) {
        const graphData = createGraphData(data.manifestationsData, data.categoryMap);
        createVisualization(graphData);
    }
}

// Start the application
init(); 