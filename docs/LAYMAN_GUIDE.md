# 🏠 Visualizing Building Data with Gridded Glyphs: A Beginner's Guide

Welcome! This guide will walk you through using the ScreenGrid library to create beautiful visualizations of your building data. Imagine you have a bunch of building polygons with details like how deprived the area is, how many vehicles are there, energy ratings, insulation, and solar panels. We'll turn that into an interactive map with colorful symbols (glyphs) that show multiple things at once.

No coding experience needed – we'll go step by step. By the end, you'll have a map that looks like this:

![Example visualization](./screengrid.png)

## 📋 What You'll Need

Before we start, make sure you have:

- **A web browser** (Chrome, Firefox, etc.)
- **A text editor** (like VS Code, Notepad++, or even Notepad)
- **Basic HTML knowledge** (don't worry, we'll provide the code)
- **Your building data** in GeoJSON format (a common format for map data)

If you don't have GeoJSON data yet, you can use online converters or tools to convert your data.

## 🗺️ Step 1: Setting Up Your Map

First, let's create a basic web page with a map. We'll use MapLibre GL JS, which is like Google Maps but free and open-source.

Create a new file called `my-building-map.html` and copy this code:

```html
<!DOCTYPE html>
<html>
<head>
    <title>My Building Data Map</title>
    <meta charset="utf-8">
    <link href="https://unpkg.com/maplibre-gl@^4/dist/maplibre-gl.css" rel="stylesheet" />
    <script src="https://unpkg.com/maplibre-gl@^4/dist/maplibre-gl.js"></script>
    <script src="https://unpkg.com/screengrid/dist/screengrid.umd.min.js"></script>
    <style>
        body { margin: 0; padding: 0; }
        #map { position: absolute; top: 0; bottom: 0; width: 100%; }
    </style>
</head>
<body>
    <div id="map"></div>
    
    <script>
        // We'll add our code here in the next steps
    </script>
</body>
</html>
```

**What this does:**
- Loads the map library (MapLibre GL JS)
- Loads our ScreenGrid library
- Creates a full-screen map container
- Sets up basic styling

Open this file in your browser – you should see a basic world map.

## 📊 Step 2: Loading Your Building Data

Now let's load your GeoJSON data. Put your data file in the same folder as your HTML file, or host it online.

Add this code inside the `<script>` tag, replacing `'your-buildings.geojson'` with your actual file name:

```javascript
// Step 2: Load your data
let buildingData;

async function loadData() {
    try {
        const response = await fetch('your-buildings.geojson');
        buildingData = await response.json();
        console.log('Data loaded!', buildingData.features.length + ' buildings');
        createMap();
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

loadData();
```

**What this does:**
- Fetches your GeoJSON file
- Stores it in `buildingData`
- Calls `createMap()` when ready (we'll create this next)

## 🏗️ Step 3: Creating the Basic Grid

Now let's create the map and add our ScreenGrid layer. Add this function after the `loadData()` function:

```javascript
function createMap() {
    // Create the map
    const map = new maplibregl.Map({
        container: 'map',
        style: 'https://demotiles.maplibre.org/style.json', // Free map style
        center: [-1.5, 53.8], // Center on UK (adjust for your data)
        zoom: 10
    });

    map.on('load', () => {
        // Create the grid layer
        const gridLayer = new ScreenGrid.ScreenGridLayerGL({
            id: 'buildings',
            source: buildingData, // Use our loaded GeoJSON
            cellSizePixels: 40, // Size of each grid square
            colorScale: (value) => [255 * value, 100, 200 * (1 - value), 180] // Purple to blue
        });
        
        // Add it to the map
        map.addLayer(gridLayer);
        
        console.log('Grid layer added!');
    });
}
```

**What this does:**
- Creates a map centered on your area
- Waits for the map to load
- Creates a ScreenGrid layer using your GeoJSON data
- Colors the grid cells based on some value (we'll customize this)

Open your HTML file in the browser. You should see colored squares representing areas with buildings!

## 🔢 Step 4: Choosing How to Combine Data (Aggregation)

Right now, the grid shows basic counts. But we want to show meaningful information. Let's decide what to show in each grid cell.

For buildings, we might want to show:
- **Average deprivation level** in that area
- **Total number of vehicles**
- **Average energy rating**

Let's modify our grid to show average deprivation:

```javascript
// In the createMap function, replace the gridLayer creation:
const gridLayer = new ScreenGrid.ScreenGridLayerGL({
    id: 'buildings',
    source: buildingData,
    cellSizePixels: 40,
    aggregationFunction: 'mean', // Average the values
    getWeight: (feature) => feature.properties.deprivation_level, // What to average
    colorScale: (value) => {
        // Red for high deprivation, green for low
        const red = Math.floor(255 * value);
        const green = Math.floor(255 * (1 - value));
        return [red, green, 50, 180];
    }
});
```

**What this does:**
- `aggregationFunction: 'mean'` - averages the values in each cell
- `getWeight` - tells the library which property to use (change to your actual property name)
- `colorScale` - creates a red-to-green color scheme

**Other aggregation options:**
- `'sum'` - add up all values
- `'count'` - just count buildings
- `'max'` - show the highest value
- `'min'` - show the lowest value

## ⚖️ Step 5: Making Colors Fair (Normalization)

Sometimes your data has very different ranges. Normalization makes sure the colors represent relative differences fairly.

For example, if deprivation levels range from 1-10, but vehicle counts range from 0-1000, we need to normalize them to 0-1 for coloring.

Let's add normalization:

```javascript
const gridLayer = new ScreenGrid.ScreenGridLayerGL({
    id: 'buildings',
    source: buildingData,
    cellSizePixels: 40,
    aggregationFunction: 'mean',
    getWeight: (feature) => feature.properties.deprivation_level,
    normalizationFunction: 'max-local', // Normalize relative to the highest in current view
    colorScale: (value) => {
        const red = Math.floor(255 * value);
        const green = Math.floor(255 * (1 - value));
        return [red, green, 50, 180];
    }
});
```

**Normalization options:**
- `'max-local'` (default) - relative to the highest value visible
- `'max-global'` - relative to a fixed maximum you provide
- `'z-score'` - statistical normalization
- `'percentile'` - based on percentiles

## 🎯 Step 6: Picking Which Attributes to Show

Your buildings have multiple attributes. Let's show several at once using **glyphs** (symbols).

First, enable glyphs and create a simple bar chart showing deprivation and vehicle count:

```javascript
const gridLayer = new ScreenGrid.ScreenGridLayerGL({
    id: 'buildings',
    source: buildingData,
    cellSizePixels: 60, // Make cells bigger for glyphs
    enableGlyphs: true, // Turn on glyph mode
    onDrawCell: (ctx, x, y, normVal, cellInfo) => {
        const { cellData } = cellInfo;
        
        // Calculate averages for this cell
        const avgDeprivation = cellData.reduce((sum, item) => 
            sum + item.data.properties.deprivation_level, 0) / cellData.length;
        const avgVehicles = cellData.reduce((sum, item) => 
            sum + item.data.properties.vehicle_count, 0) / cellData.length;
        
        // Draw a simple bar chart
        const barWidth = 8;
        const maxHeight = 30;
        
        // Deprivation bar (red)
        ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
        ctx.fillRect(x - 15, y - maxHeight * avgDeprivation / 10, barWidth, maxHeight * avgDeprivation / 10);
        
        // Vehicle bar (blue)
        ctx.fillStyle = 'rgba(0, 0, 255, 0.8)';
        ctx.fillRect(x - 5, y - maxHeight * avgVehicles / 50, barWidth, maxHeight * avgVehicles / 50);
        
        // EPC rating as circle size (green)
        const avgEPC = cellData.reduce((sum, item) => 
            sum + item.data.properties.epc_rating, 0) / cellData.length;
        ctx.fillStyle = 'rgba(0, 255, 0, 0.6)';
        ctx.beginPath();
        ctx.arc(x + 10, y, 5 + avgEPC, 0, 2 * Math.PI);
        ctx.fill();
    }
});
```

**What this does:**
- `enableGlyphs: true` - switches to glyph mode
- `onDrawCell` - custom function to draw symbols
- Calculates averages for each attribute in the cell
- Draws bars for deprivation and vehicles
- Draws circles for EPC rating

## 🎨 Step 7: Designing Your Own Glyphs

Let's make a more sophisticated glyph. How about a "building block" that shows multiple attributes?

```javascript
onDrawCell: (ctx, x, y, normVal, cellInfo) => {
    const { cellData, glyphRadius } = cellInfo;
    
    // Calculate cell statistics
    const stats = cellData.reduce((acc, item) => {
        acc.deprivation += item.data.properties.deprivation_level;
        acc.vehicles += item.data.properties.vehicle_count;
        acc.epc += item.data.properties.epc_rating;
        acc.insulation += item.data.properties.insulation_status === 'good' ? 1 : 0;
        acc.solar += item.data.properties.rooftop_pv ? 1 : 0;
        acc.count++;
        return acc;
    }, { deprivation: 0, vehicles: 0, epc: 0, insulation: 0, solar: 0, count: 0 });
    
    // Average the values
    Object.keys(stats).forEach(key => {
        if (key !== 'count') stats[key] /= stats.count;
    });
    
    const radius = glyphRadius * 0.8;
    
    // Main building shape (square)
    ctx.fillStyle = `hsl(${240 - stats.deprivation * 24}, 70%, 50%)`; // Blue to red based on deprivation
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    
    // Insulation status (border)
    ctx.strokeStyle = stats.insulation > 0.5 ? '#00ff00' : '#ff0000';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - radius, y - radius, radius * 2, radius * 2);
    
    // Solar panel (triangle on top)
    if (stats.solar > 0.5) {
        ctx.fillStyle = '#ffff00';
        ctx.beginPath();
        ctx.moveTo(x - radius, y - radius);
        ctx.lineTo(x + radius, y - radius);
        ctx.lineTo(x, y - radius * 1.5);
        ctx.closePath();
        ctx.fill();
    }
    
    // Vehicle count (small circles)
    const vehicleCount = Math.round(stats.vehicles);
    ctx.fillStyle = '#666666';
    for (let i = 0; i < Math.min(vehicleCount, 5); i++) {
        ctx.beginPath();
        ctx.arc(x - radius + 5 + i * 8, y + radius + 5, 3, 0, 2 * Math.PI);
        ctx.fill();
    }
    
    // EPC rating (inner circle)
    ctx.fillStyle = `hsl(${120 + stats.epc * 60}, 70%, 50%)`; // Green to yellow
    ctx.beginPath();
    ctx.arc(x, y, radius * 0.5, 0, 2 * Math.PI);
    ctx.fill();
}
```

This creates a "building block" glyph showing:
- **Color**: Deprivation level (blue = low, red = high)
- **Border**: Insulation status (green = good, red = poor)
- **Triangle**: Solar panels (yellow if present)
- **Dots**: Vehicle count
- **Inner circle**: EPC rating

## 👆 Step 8: Adding Hover Interactions

Let's add hover effects so users can see details when they move their mouse over cells.

Add this after creating the grid layer:

```javascript
// Add hover interaction
gridLayer.setConfig({
    onHover: ({ cell }) => {
        if (cell) {
            const stats = cell.cellData.reduce((acc, item) => {
                acc.buildings++;
                acc.avgDeprivation = (acc.avgDeprivation + item.data.properties.deprivation_level) / 2;
                acc.totalVehicles += item.data.properties.vehicle_count;
                return acc;
            }, { buildings: 0, avgDeprivation: 0, totalVehicles: 0 });
            
            // Update a tooltip or info panel
            updateInfoPanel(stats);
        } else {
            hideInfoPanel();
        }
    }
});

// Add info panel to HTML
function updateInfoPanel(stats) {
    let panel = document.getElementById('info-panel');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'info-panel';
        panel.style.cssText = `
            position: absolute; top: 10px; right: 10px; 
            background: white; padding: 10px; border-radius: 5px;
            box-shadow: 0 0 10px rgba(0,0,0,0.3); z-index: 1000;
        `;
        document.body.appendChild(panel);
    }
    panel.innerHTML = `
        <h3>Area Information</h3>
        <p><strong>Buildings:</strong> ${stats.buildings}</p>
        <p><strong>Avg Deprivation:</strong> ${stats.avgDeprivation.toFixed(1)}</p>
        <p><strong>Total Vehicles:</strong> ${stats.totalVehicles}</p>
    `;
}

function hideInfoPanel() {
    const panel = document.getElementById('info-panel');
    if (panel) panel.style.display = 'none';
}
```

Now when you hover over cells, you'll see a popup with information!

## 🏷️ Step 9: Adding a Legend

A legend helps people understand what the colors and symbols mean.

Add this after creating the grid layer:

```javascript
// Create legend
const legend = new ScreenGrid.Legend({
    layer: gridLayer,
    type: 'multi', // Multiple attributes
    position: 'bottom-left',
    title: 'Building Attributes'
});

// Add legend to map
map.addControl(legend, 'bottom-left');
```

For a custom legend, you can create your own:

```javascript
// Custom legend HTML
const legendHtml = `
    <div style="background: white; padding: 10px; border-radius: 5px; box-shadow: 0 0 10px rgba(0,0,0,0.3);">
        <h4>Legend</h4>
        <div><span style="color: blue;">■</span> Low Deprivation</div>
        <div><span style="color: red;">■</span> High Deprivation</div>
        <div><span style="color: green; border: 2px solid green;">□</span> Good Insulation</div>
        <div><span style="color: gold;">▲</span> Solar Panels</div>
        <div><span style="color: gray;">●</span> Vehicles</div>
        <div><span style="color: lime;">●</span> Good EPC Rating</div>
    </div>
`;

const legendControl = {
    onAdd: (map) => {
        const div = document.createElement('div');
        div.innerHTML = legendHtml;
        return div;
    }
};

map.addControl(legendControl, 'bottom-right');
```

## 💡 Tips and Tricks

### 🎨 Making It Look Good
- **Color choices**: Use colorblind-friendly palettes
- **Size matters**: Adjust `cellSizePixels` based on your data density
- **Don't overcrowd**: Too many attributes in one glyph can be confusing

### 🚀 Performance Tips
- **Large datasets**: Use `cellSizePixels: 50` or larger for better performance
- **Zoom levels**: Consider different visualizations for different zoom levels
- **Data simplification**: Aggregate or sample your data if it's too big

### 🔧 Troubleshooting
- **Nothing shows up**: Check browser console for errors
- **Colors wrong**: Verify your property names match your data
- **Slow performance**: Try larger cells or less detailed glyphs

### 🎯 Advanced Ideas
- **Time animation**: Add a time slider to show changes over time
- **Filtering**: Add buttons to show/hide different attributes
- **Comparison mode**: Side-by-side maps for different scenarios

## 🎉 You're Done!

You've created an interactive map that shows multiple building attributes in one view. Your glyphs tell a story about deprivation, energy efficiency, and sustainability in your area.

**Next steps:**
1. Customize the colors and shapes to match your needs
2. Add more interactions (clicking, filtering)
3. Share your map online
4. Explore the other examples in the `examples/` folder

Remember, the best visualizations are those that help people understand and act on the data. Keep experimenting!

---

*This guide was created for the ScreenGrid library. For more advanced features, check the full documentation.*