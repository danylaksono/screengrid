import { ScreenGridLayerGL } from "../../src/index.js";

const map = new maplibregl.Map({
  container: "map",
  style: "https://demotiles.maplibre.org/style.json",
  center: [-122.4, 37.74],
  zoom: 11
});

// Custom glyph drawing function for bike parking data
function drawBikeParkingGlyph(ctx, x, y, normVal, cellInfo) {
  const { cellData, glyphRadius, cellSize } = cellInfo;
  
  if (cellData.length === 0) return;
  
  // Calculate aggregated values for this cell
  const totalRacks = cellData.reduce((sum, item) => sum + item.data.RACKS, 0);
  const totalSpaces = cellData.reduce((sum, item) => sum + item.data.SPACES, 0);
  const avgRacksPerSpace = totalRacks / totalSpaces;
  
  // Draw background circle with intensity based on total spaces
  const alpha = Math.min(0.8, normVal * 0.8 + 0.2);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = `hsl(${200 + normVal * 60}, 70%, 50%)`;
  ctx.beginPath();
  ctx.arc(x, y, glyphRadius, 0, 2 * Math.PI);
  ctx.fill();
  
  // Draw inner circle representing racks
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = '#2c3e50';
  const innerRadius = glyphRadius * 0.6;
  ctx.beginPath();
  ctx.arc(x, y, innerRadius, 0, 2 * Math.PI);
  ctx.fill();
  
  // Draw rack indicators (small rectangles)
  const rackCount = Math.min(totalRacks, 8); // Cap at 8 for visibility
  const angleStep = (2 * Math.PI) / rackCount;
  const rackRadius = innerRadius * 0.7;
  
  ctx.fillStyle = '#ecf0f1';
  for (let i = 0; i < rackCount; i++) {
    const angle = i * angleStep;
    const rackX = x + Math.cos(angle) * rackRadius;
    const rackY = y + Math.sin(angle) * rackRadius;
    
    ctx.save();
    ctx.translate(rackX, rackY);
    ctx.rotate(angle);
    ctx.fillRect(-2, -4, 4, 8);
    ctx.restore();
  }
  
  // Draw space count as text
  if (totalSpaces > 0) {
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.max(8, glyphRadius * 0.4)}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(totalSpaces.toString(), x, y);
  }
}

// Alternative glyph: Bar chart showing racks vs spaces
function drawBarChartGlyph(ctx, x, y, normVal, cellInfo) {
  const { cellData, cellSize } = cellInfo;
  
  if (cellData.length === 0) return;
  
  const totalRacks = cellData.reduce((sum, item) => sum + item.data.RACKS, 0);
  const totalSpaces = cellData.reduce((sum, item) => sum + item.data.SPACES, 0);
  const maxValue = Math.max(totalRacks, totalSpaces, 1);
  
  // Draw bars
  const barWidth = cellSize * 0.3;
  const maxHeight = cellSize * 0.6;
  
  // Racks bar (blue)
  const racksHeight = (totalRacks / maxValue) * maxHeight;
  ctx.fillStyle = '#3498db';
  ctx.fillRect(x - barWidth/2, y + maxHeight/2 - racksHeight, barWidth, racksHeight);
  
  // Spaces bar (green)
  const spacesHeight = (totalSpaces / maxValue) * maxHeight;
  ctx.fillStyle = '#2ecc71';
  ctx.fillRect(x + barWidth/2, y + maxHeight/2 - spacesHeight, barWidth, spacesHeight);
  
  // Add labels
  ctx.fillStyle = '#2c3e50';
  ctx.font = `${Math.max(6, cellSize * 0.15)}px Arial`;
  ctx.textAlign = 'center';
  ctx.fillText('R', x - barWidth/2, y + maxHeight/2 + 10);
  ctx.fillText('S', x + barWidth/2, y + maxHeight/2 + 10);
}

map.on("load", async () => {
  const data = await fetch(
    "https://raw.githubusercontent.com/visgl/deck.gl-data/master/website/sf-bike-parking.json"
  ).then((r) => r.json());

  // Create a toggle for different visualization modes
  let useGlyphs = true;
  let glyphType = 'bike'; // 'bike' or 'bar'
  
  const gridLayer = new ScreenGridLayerGL({
    data,
    getPosition: (d) => d.COORDINATES,
    getWeight: (d) => d.SPACES,
    cellSizePixels: 60,
    colorScale: (v) => [255 * v, 200 * (1 - v), 50, 220],
    enableGlyphs: useGlyphs,
    glyphSize: 0.8,
    onDrawCell: (ctx, x, y, normVal, cellInfo) => {
      if (glyphType === 'bike') {
        drawBikeParkingGlyph(ctx, x, y, normVal, cellInfo);
      } else {
        drawBarChartGlyph(ctx, x, y, normVal, cellInfo);
      }
    },
    onAggregate: (grid) => {
      console.log("Aggregated grid:", grid);
      console.log(`Total cells with data: ${grid.grid.filter(v => v > 0).length}`);
    },
    onHover: ({ cell }) => {
      if (cell.cellData && cell.cellData.length > 0) {
        const totalRacks = cell.cellData.reduce((sum, item) => sum + item.data.RACKS, 0);
        const totalSpaces = cell.cellData.reduce((sum, item) => sum + item.data.SPACES, 0);
        console.log(`Cell: ${totalRacks} racks, ${totalSpaces} spaces`);
      }
    },
    onClick: ({ cell }) => {
      if (cell.cellData && cell.cellData.length > 0) {
        const totalRacks = cell.cellData.reduce((sum, item) => sum + item.data.RACKS, 0);
        const totalSpaces = cell.cellData.reduce((sum, item) => sum + item.data.SPACES, 0);
        alert(`Cell Details:\nRacks: ${totalRacks}\nSpaces: ${totalSpaces}\nData Points: ${cell.cellData.length}`);
      }
    }
  });

  map.addLayer(gridLayer);
  
  // Add controls for toggling visualization modes
  const controls = document.createElement('div');
  controls.style.cssText = `
    position: absolute;
    top: 10px;
    right: 10px;
    background: white;
    padding: 10px;
    border-radius: 5px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    z-index: 1000;
  `;
  
  const toggleButton = document.createElement('button');
  toggleButton.textContent = useGlyphs ? 'Switch to Color' : 'Switch to Glyphs';
  toggleButton.onclick = () => {
    useGlyphs = !useGlyphs;
    gridLayer.setConfig({ enableGlyphs: useGlyphs });
    toggleButton.textContent = useGlyphs ? 'Switch to Color' : 'Switch to Glyphs';
  };
  
  const glyphToggle = document.createElement('button');
  glyphToggle.textContent = 'Switch Glyph Type';
  glyphToggle.onclick = () => {
    glyphType = glyphType === 'bike' ? 'bar' : 'bike';
    glyphToggle.textContent = `Current: ${glyphType === 'bike' ? 'Bike Icons' : 'Bar Chart'}`;
  };
  
  controls.appendChild(toggleButton);
  controls.appendChild(document.createElement('br'));
  controls.appendChild(glyphToggle);
  document.body.appendChild(controls);
});
