---
name: d3-visualization
description: Create sophisticated, interactive data visualizations using D3.js. Use for custom charts, network visualizations, or when Recharts/charting libraries are insufficient.
---

# D3.js Visualization Skill

This skill provides guidance for creating sophisticated, interactive data visualizations using D3.js.

## When to Use D3.js

**Use D3.js for:**
- Custom visualizations requiring unique visual encodings or layouts
- Interactive explorations with complex pan, zoom, or brush behaviors
- Network/graph visualizations (force-directed layouts, tree diagrams, hierarchies)
- Geographic visualizations with custom projections
- Visualizations requiring smooth, choreographed transitions
- Publication-quality graphics with fine-grained styling control

**Consider alternatives for:**
- Standard charts (bar, line, pie) → Use Recharts (already in your stack)
- 3D visualizations → Use Three.js
- Simple dashboards → Use your existing Recharts components

## Core Workflow

### 1. Set Up D3.js

```javascript
import * as d3 from 'd3';
```

### 2. Structure the Visualization Code

```javascript
function drawVisualization(data, svgElement) {
  if (!data || data.length === 0) return;

  const svg = d3.select(svgElement);
  svg.selectAll("*").remove(); // Clear previous render

  // 1. Define dimensions
  const width = 800;
  const height = 400;
  const margin = { top: 20, right: 30, bottom: 40, left: 50 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  // 2. Create main group with margins
  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // 3. Create scales
  const xScale = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.x)])
    .range([0, innerWidth]);

  const yScale = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.y)])
    .range([innerHeight, 0]); // Inverted for SVG coordinates

  // 4. Create and append axes
  g.append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(xScale));

  g.append("g")
    .call(d3.axisLeft(yScale));

  // 5. Bind data and create visual elements
  g.selectAll("circle")
    .data(data)
    .join("circle")
    .attr("cx", d => xScale(d.x))
    .attr("cy", d => yScale(d.y))
    .attr("r", 5)
    .attr("fill", "steelblue");
}
```

### 3. Implement Responsive Sizing

```javascript
function setupResponsiveChart(containerId, data) {
  const container = document.getElementById(containerId);
  const svg = d3.select(`#${containerId}`).append('svg');

  function updateChart() {
    const { width, height } = container.getBoundingClientRect();
    svg.attr('width', width).attr('height', height);
    drawChart(data, svg, width, height);
  }

  updateChart();
  window.addEventListener('resize', updateChart);
  return () => window.removeEventListener('resize', updateChart);
}
```

## Common Patterns

### Bar Chart
```javascript
const xScale = d3.scaleBand()
  .domain(data.map(d => d.category))
  .range([0, innerWidth])
  .padding(0.1);

g.selectAll("rect")
  .data(data)
  .join("rect")
  .attr("x", d => xScale(d.category))
  .attr("y", d => yScale(d.value))
  .attr("width", xScale.bandwidth())
  .attr("height", d => innerHeight - yScale(d.value))
  .attr("fill", "steelblue");
```

### Line Chart
```javascript
const line = d3.line()
  .x(d => xScale(d.date))
  .y(d => yScale(d.value))
  .curve(d3.curveMonotoneX);

g.append("path")
  .datum(data)
  .attr("fill", "none")
  .attr("stroke", "steelblue")
  .attr("stroke-width", 2)
  .attr("d", line);
```

## Best Practices

### Data Preparation
```javascript
const cleanData = data.filter(d => d.value != null && !isNaN(d.value));
const sortedData = [...data].sort((a, b) => b.value - a.value);
```

### Accessibility
```javascript
svg.attr("role", "img")
   .attr("aria-label", "Bar chart showing quarterly revenue");

svg.append("title").text("Quarterly Revenue 2024");
```

### Consistent Styling
```javascript
const colours = {
  primary: '#4A90E2',
  secondary: '#7B68EE',
  background: '#F5F7FA',
  text: '#333333',
  gridLines: '#E0E0E0'
};

svg.selectAll("text")
  .style("font-family", "Inter, sans-serif")
  .style("font-size", "12px");
```

### Performance (>1000 elements)
- Use canvas instead of SVG for many elements
- Use quadtree for collision detection
- Simplify paths with `d3.line().curve(d3.curveStep)`
- Implement virtual scrolling for large lists
