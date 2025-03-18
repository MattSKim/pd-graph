// Set up the SVG container with larger dimensions
const width = 1600;  // Increased from 960
const height = 900;  // Increased from 600

// Create zoom behavior
const zoom = d3.zoom()
    .scaleExtent([0.1, 4])  // Min/max zoom scale
    .on("zoom", zoomed);

// Color scale for different categories
const colorScale = d3.scaleOrdinal()
    .domain([
        'protein',
        'neurotransmitter',
        'brain_region',
        'enzyme',
        'transcription_factor',
        'clinical_symptom',
        'assessment_tool',
        'gene'
    ])
    .range([
        '#ff7f0e',  // Orange for proteins
        '#1f77b4',  // Blue for neurotransmitters
        '#2ca02c',  // Green for brain regions
        '#d62728',  // Red for enzymes
        '#9467bd',  // Purple for transcription factors
        '#e377c2',  // Pink for clinical symptoms
        '#17becf',  // Cyan for assessment tools
        '#bcbd22'   // Yellow-green for genes
    ]);

const svg = d3.select("#graph")
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .call(zoom);  // Enable zoom on SVG

// Create a container group for all elements that should be zoomed
const container = svg.append("g")
    .attr("class", "zoom-container");

// Create HTML-based legend in the info panel
const categories = [
    'protein',
    'neurotransmitter',
    'brain_region',
    'enzyme',
    'transcription_factor',
    'clinical_symptom',
    'assessment_tool',
    'gene'
];

const legendHtml = `
    <h4>Categories</h4>
    ${categories.map(category => `
        <div style="display: flex; align-items: center; margin: 8px 0;">
            <div style="
                width: 12px;
                height: 12px;
                border-radius: 50%;
                background: ${colorScale(category)};
                margin-right: 8px;
            "></div>
            <span>${category.replace(/_/g, ' ')}</span>
        </div>
    `).join('')}
`;

document.getElementById('categories-legend').innerHTML = legendHtml;

// Create force simulation
const simulation = d3.forceSimulation()
    .force("link", d3.forceLink().id(d => d.id))
    .force("charge", d3.forceManyBody().strength(-300))
    .force("center", d3.forceCenter(width / 2, height / 2));

// Add scale filter functionality
const scaleSelect = document.getElementById('scale-select');
const showConnectedCheckbox = document.getElementById('show-connected');
scaleSelect.addEventListener('change', updateVisibility);
showConnectedCheckbox.addEventListener('change', updateVisibility);

function updateVisibility() {
    const selectedScale = scaleSelect.value;
    const showConnected = showConnectedCheckbox.checked;
    
    if (selectedScale === 'all') {
        // Reset everything to visible and clear edge labels/arrows
        container.selectAll(".node, text")
            .style("opacity", 1);
        
        container.selectAll(".link-group")
            .style("opacity", 1);
        
        container.selectAll(".edge-label")
            .style("opacity", 0);
        
        container.selectAll(".link-visible")
            .attr("marker-end", null);
            
        return;
    }
    
    // Store current state of edge labels and arrows
    const edgeStates = new Map();
    container.selectAll(".link-group").each(function(d) {
        const group = d3.select(this);
        const label = group.select(".edge-label");
        const line = group.select(".link-visible");
        edgeStates.set(d.source.id + "-" + d.target.id, {
            labelVisible: label.style("opacity") !== "0",
            hasArrow: line.attr("marker-end") !== null
        });
    });
    
    // Get nodes of selected scale
    const selectedNodes = new Set();
    const connectedNodes = new Set();
    
    // First pass: identify nodes of selected scale
    container.selectAll(".node").each(function(d) {
        if (selectedScale === 'all' || d.scale === selectedScale) {
            selectedNodes.add(d.id);
        }
    });
    
    // Second pass: identify connected nodes if checkbox is checked
    if (showConnected && selectedScale !== 'all') {
        container.selectAll(".link-group").each(function(d) {
            if (selectedNodes.has(d.source.id)) {
                connectedNodes.add(d.target.id);
            }
            if (selectedNodes.has(d.target.id)) {
                connectedNodes.add(d.source.id);
            }
        });
    }
    
    // Update nodes visibility
    container.selectAll(".node")
        .style("opacity", d => {
            if (selectedScale === 'all' || d.scale === selectedScale) return 1;
            return showConnected && connectedNodes.has(d.id) ? 0.3 : 0.01;
        })
        .style("pointer-events", d => {
            if (selectedScale === 'all' || d.scale === selectedScale) return "all";
            return showConnected && connectedNodes.has(d.id) ? "all" : "none";
        });
    
    container.selectAll("text")
        .style("opacity", d => {
            if (selectedScale === 'all' || d.scale === selectedScale) return 1;
            return showConnected && connectedNodes.has(d.id) ? 0.3 : 0.01;
        })
        .style("pointer-events", d => {
            if (selectedScale === 'all' || d.scale === selectedScale) return "all";
            return showConnected && connectedNodes.has(d.id) ? "all" : "none";
        });
    
    // Update links visibility
    container.selectAll(".link-group")
        .style("opacity", d => {
            if (selectedScale === 'all') return 1;
            if (!showConnected) {
                return (d.source.scale === selectedScale && d.target.scale === selectedScale) ? 1 : 0.01;
            }
            const sourceVisible = d.source.scale === selectedScale || selectedNodes.has(d.source.id);
            const targetVisible = d.target.scale === selectedScale || selectedNodes.has(d.target.id);
            return (sourceVisible || targetVisible) ? (d.source.scale === selectedScale && d.target.scale === selectedScale ? 1 : 0.3) : 0.01;
        })
        .each(function(d) {
            const group = d3.select(this);
            const isVisible = group.style("opacity") > 0.01;
            
            // Set pointer events for all elements in the group
            group.selectAll("*")
                .style("pointer-events", isVisible ? "all" : "none");
            
            // Make hover area cover the entire edge
            if (isVisible) {
                group.select(".link-hover")
                    .attr("stroke-width", 20)
                    .style("pointer-events", "stroke");
            }
        });

    // Restore edge states for visible edges
    container.selectAll(".link-group").each(function(d) {
        const group = d3.select(this);
        if (group.style("opacity") !== "0") {
            const state = edgeStates.get(d.source.id + "-" + d.target.id);
            if (state) {
                group.select(".edge-label")
                    .style("opacity", state.labelVisible ? 1 : 0);
                group.select(".link-visible")
                    .attr("marker-end", state.hasArrow ? "url(#arrow)" : null);
            }
            // Ensure hover line has pointer events
            group.select(".link-hover")
                .style("pointer-events", "all");
        } else {
            // Disable pointer events for hidden links
            group.select(".link-hover")
                .style("pointer-events", "none");
        }
    });
}

// Load and process the JSON data
d3.json("data/pd.json").then(function(data) {
    // Create a set of valid node IDs for quick lookup
    const validNodeIds = new Set(data.nodes.map(node => node.id));

    // Filter links to only include those where both source and target nodes exist
    const validLinks = data.links.filter(link => 
        validNodeIds.has(link.source) && validNodeIds.has(link.target)
    );

    // Log any invalid links for debugging
    const invalidLinks = data.links.filter(link => 
        !validNodeIds.has(link.source) || !validNodeIds.has(link.target)
    );
    if (invalidLinks.length > 0) {
        console.warn('Found invalid links:', invalidLinks);
    }

    // Create the graph elements
    const link = container.append("g")
        .selectAll("g")
        .data(validLinks)
        .enter()
        .append("g")
        .attr("class", "link-group")
        .each(function(d) {
            const g = d3.select(this);
            
            // Add visible line first (so it's behind)
            g.append("line")
                .attr("class", "link-visible")
                .attr("stroke-width", 3);
            
            // Add invisible wider line for hover detection
            g.append("line")
                .attr("class", "link-hover")
                .attr("stroke-width", 15)
                .attr("stroke", "#999")
                .attr("stroke-opacity", 0)
                .style("pointer-events", "all")
                .on("mouseover", handleLinkHover)
                .on("mouseout", handleLinkMouseOut)
                .on("click", handleLinkClick);

            // Add edge label (initially hidden)
            g.append("text")
                .attr("class", "edge-label")
                .attr("text-anchor", "middle")
                .attr("dy", -5)
                .style("font-style", "italic")
                .style("fill", "#999")
                .style("font-size", "12px")
                .style("opacity", 0);  // Start hidden
        });

    const node = container.append("g")  // Changed from svg to container
        .selectAll("circle")
        .data(data.nodes)
        .enter()
        .append("circle")
        .attr("class", "node")
        .attr("r", d => d.category === 'assessment_tool' ? 12 : 8)  // Larger size for assessment tools
        .attr("fill", d => colorScale(d.category))
        .on("mouseover", handleNodeHover)
        .on("mouseout", handleMouseOut)
        .on("click", handleNodeClick)
        .call(d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended));

    // Add node labels
    const labels = container.append("g")  // Changed from svg to container
        .selectAll("text")
        .data(data.nodes)
        .enter()
        .append("text")
        .text(d => d.name)
        .attr("font-size", "14px")
        .attr("dx", 12)
        .attr("dy", 4);

    // Update positions on each tick
    simulation
        .nodes(data.nodes)
        .on("tick", ticked);

    simulation.force("link")
        .links(validLinks);

    // Add arrow markers for directed edges
    svg.append("defs").selectAll("marker")
        .data(["directed"])
        .enter().append("marker")
        .attr("id", "arrow")
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 15)  // Move closer to edge end
        .attr("refY", 0)
        .attr("markerWidth", 4)  // Smaller width
        .attr("markerHeight", 4)  // Smaller height
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,-5L10,0L0,5")
        .attr("fill", "#999");

    function ticked() {
        // Update both visible and hover lines
        container.selectAll(".link-group line")
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);

        // Update edge labels position
        container.selectAll(".edge-label")
            .attr("x", d => (d.source.x + d.target.x) / 2)
            .attr("y", d => (d.source.y + d.target.y) / 2)
            .text(d => d.interaction.replace(/_/g, ' '));

        node
            .attr("cx", d => d.x)
            .attr("cy", d => d.y);

        labels
            .attr("x", d => d.x)
            .attr("y", d => d.y);
    }
});

// Zoom function
function zoomed(event) {
    container.attr("transform", event.transform);
}

// Modified drag functions to work with zoom
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

// Function to show node information in the info panel
function showNodeInfo(event, d) {
    const infoContent = document.getElementById("info-content");
    let html = `<h4>${d.name}</h4>`;
    
    if (d.category) {
        html += `<p><strong>Category:</strong> ${d.category}</p>`;
    }
    if (d.function) {
        html += `<p><strong>Function:</strong> ${d.function}</p>`;
    }
    if (d.role_in_PD) {
        html += `<p><strong>Role in PD:</strong> ${d.role_in_PD}</p>`;
    }
    
    infoContent.innerHTML = html;
}

// Function to show link information in the info panel
function showLinkInfo(event, d) {
    const infoContent = document.getElementById("info-content");
    let html = `<h4>Relationship</h4>`;
    
    html += `<p><strong>From:</strong> ${d.source.name}</p>`;
    html += `<p><strong>To:</strong> ${d.target.name}</p>`;
    if (d.interaction) {
        html += `<p><strong>Interaction:</strong> ${d.interaction.replace(/_/g, ' ')}</p>`;
    }
    if (d.description) {
        html += `<p><strong>Description:</strong> ${d.description}</p>`;
    }
    
    infoContent.innerHTML = html;
}

let isInfoLocked = false;  // Track whether info panel is locked
let selectedElement = null;  // Track currently selected element

function handleNodeHover(event, d) {
    // No action needed here
}

function handleLinkHover(event, d) {
    // Always show edge label on hover, regardless of info lock status
    const group = d3.select(event.currentTarget.parentNode);
    group.select(".edge-label").style("opacity", 1);
    
    // Add arrow if edge is directed
    if (d.directed) {
        group.select(".link-visible").attr("marker-end", "url(#arrow)");
    }
}

function handleMouseOut(event) {
    // No action needed here
}

// Modify the handleLinkMouseOut function to hide edge labels
function handleLinkMouseOut(event, d) {
    // Always hide edge label when not hovering, regardless of info lock status
    const group = d3.select(event.currentTarget.parentNode);
    group.select(".edge-label").style("opacity", 0);
    
    // Remove arrow
    group.select(".link-visible").attr("marker-end", null);
}

function handleNodeClick(event, d) {
    event.stopPropagation();
    // Unhighlight previous selection
    if (selectedElement) {
        d3.select(selectedElement).classed("selected", false);
        // If clicking the same node, unselect it
        if (selectedElement === event.currentTarget) {
            selectedElement = null;
            isInfoLocked = false;
            hideInfo();
            return;
        }
    }
    // Highlight this node
    const thisNode = d3.select(event.currentTarget);
    thisNode.classed("selected", true);
    selectedElement = event.currentTarget;
    isInfoLocked = true;
    showNodeInfo(event, d);
}

function handleLinkClick(event, d) {
    event.stopPropagation();
    // Unhighlight previous selection
    if (selectedElement) {
        d3.select(selectedElement).classed("selected", false);
        // If clicking the same link, unselect it
        const thisLink = d3.select(event.currentTarget.parentNode).select(".link-visible").node();
        if (selectedElement === thisLink) {
            selectedElement = null;
            isInfoLocked = false;
            hideInfo();
            return;
        }
    }
    // Highlight this link
    const thisLink = d3.select(event.currentTarget.parentNode).select(".link-visible");
    thisLink.classed("selected", true);
    selectedElement = thisLink.node();
    isInfoLocked = true;
    showLinkInfo(event, d);
}

function hideInfo() {
    if (!isInfoLocked) {
        const infoContent = document.getElementById("info-content");
        infoContent.innerHTML = "Click on nodes or edges to see information";
    }
}

// Add click handler to clear info when clicking on blank space
svg.on("click", function(event) {
    if (event.target.tagName === "svg") {
        isInfoLocked = false;
        // Unhighlight any selected element
        if (selectedElement) {
            d3.select(selectedElement).classed("selected", false);
            selectedElement = null;
        }
        hideInfo();
    }
}); 