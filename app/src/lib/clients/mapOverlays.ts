// mapOverlays.ts

export function createDaylightOverlay(svgElement: SVGSVGElement): SVGPathElement {
    const overlay = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    overlay.setAttribute('fill', 'rgba(255, 255, 0, 0.2)');
    svgElement.appendChild(overlay);
    return overlay;
}

export function updateDaylightOverlay(overlay: SVGPathElement, date: Date) {
    const path = calculateDaylightPath(date);
    overlay.setAttribute('d', path);
}

export function createTimeZoneOverlay(svgElement: SVGSVGElement): SVGGElement {
    const overlay = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    for (let i = -12; i <= 12; i++) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        const x = (i + 12) * (1009.6727 / 24);
        line.setAttribute('x1', `${x}`);
        line.setAttribute('y1', '0');
        line.setAttribute('x2', `${x}`);
        line.setAttribute('y2', '665.96301');
        line.setAttribute('stroke', 'rgba(255, 255, 255, 0.3)');
        line.setAttribute('stroke-width', '1');
        overlay.appendChild(line);

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', `${x}`);
        text.setAttribute('y', '20');
        text.setAttribute('fill', 'white');
        text.setAttribute('font-size', '12');
        text.setAttribute('text-anchor', 'middle');
        text.textContent = `UTC${i > 0 ? '+' : ''}${i !== 0 ? i : ''}`;
        overlay.appendChild(text);
    }
    svgElement.appendChild(overlay);
    return overlay;
}
function getDayOfYear(date: Date): number {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = (date.getTime() - start.getTime()) + ((start.getTimezoneOffset() - date.getTimezoneOffset()) * 60 * 1000);
    const oneDay = 1000 * 60 * 60 * 24;
    return Math.floor(diff / oneDay);
}

function calculateDaylightPath(date: Date): string {
    const dayOfYear = getDayOfYear(date);
    const declination = 23.45 * Math.sin((360 / 365) * (dayOfYear - 81) * Math.PI / 180);
    const hourAngle = 15 * (date.getUTCHours() + date.getUTCMinutes() / 60 - 12);

    let path = 'M0,0 '; // Start at the top left corner of the SVG
    let prevX = null;

    for (let lon = -180; lon <= 180; lon += 1) {
        const lat = Math.atan(-Math.cos((lon + hourAngle) * Math.PI / 180) / Math.tan(declination * Math.PI / 180)) * 180 / Math.PI;
        const x = (lon + 180) * (1009.6727 / 360);
        const y = (90 - lat) * (665.96301 / 180);

        if (prevX !== null && Math.abs(x - prevX) > (1009.6727 / 2)) {
            path += `L${1009.6727},${y} `;
            path += `M0,${y} `;
        }

        path += `L${x},${y} `;
        prevX = x;
    }

    path += 'L1009.6727,665.96301 '; // Draw to the bottom right corner
    path += 'L0,665.96301 Z'; // Close the path by drawing to the bottom left corner and back to the start

    return path;
}

