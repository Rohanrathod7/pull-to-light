const ropeCanvas = document.getElementById('rope-canvas');
const ropePath = document.getElementById('rope');
const handle = document.getElementById('handle');
const statusTextItalic = document.querySelector('.italic-text');
const body = document.body;

// --- CONFIGURATION ---
const CONFIG = {
    segmentCount: 15,
    segmentLength: 15,
    gravity: 0.5,
    friction: 0.98,
    stiffness: 10,  // Constraint iterations
    handleWidth: 40,
    handleHeight: 70,
    threshold: 120, // Distance beyond rest to toggle
};

// --- STATE ---
let anchorX = window.innerWidth / 2;
const anchorY = 0;
let isDragging = false;
let isLightMode = false;
let hasToggledInThisDrag = false;

// --- PHYSICS SYSTEM (Verlet Integration) ---
class Point {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.oldX = x;
        this.oldY = y;
        this.isPinned = false;
    }

    update() {
        if (this.isPinned) return;
        
        // Verlet Integration: pos = pos + (pos - oldPos) + accel
        const vx = (this.x - this.oldX) * CONFIG.friction;
        const vy = (this.y - this.oldY) * CONFIG.friction;
        
        this.oldX = this.x;
        this.oldY = this.y;
        
        this.x += vx;
        this.y += vy;
        this.y += CONFIG.gravity;
    }
}

class Stick {
    constructor(p1, p2, length) {
        this.p1 = p1;
        this.p2 = p2;
        this.length = length;
    }

    update() {
        const dx = this.p2.x - this.p1.x;
        const dy = this.p2.y - this.p1.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const difference = (this.length - distance) / distance;
        const offsetX = dx * difference * 0.5;
        const offsetY = dy * difference * 0.5;

        if (!this.p1.isPinned) {
            this.p1.x -= offsetX;
            this.p1.y -= offsetY;
        }
        if (!this.p2.isPinned) {
            this.p2.x += offsetX;
            this.p2.y += offsetY;
        }
    }
}

// Initializing the chain
let points = [];
let sticks = [];
const totalLength = window.innerHeight * 0.25;
const segLen = totalLength / CONFIG.segmentCount;

for (let i = 0; i < CONFIG.segmentCount; i++) {
    const p = new Point(anchorX, i * segLen);
    if (i === 0) p.isPinned = true;
    points.push(p);
    
    if (i > 0) {
        sticks.push(new Stick(points[i - 1], points[i], segLen));
    }
}

// The Handle is attached to the last point
const handlePoint = points[points.length - 1];

// --- INTERACTION ---
function getPointerPos(e) {
    if (e.touches) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    return { x: e.clientX, y: e.clientY };
}

function startDrag(e) {
    isDragging = true;
    e.preventDefault();
}

function updateDrag(e) {
    if (!isDragging) return;
    const pos = getPointerPos(e);
    handlePoint.x = pos.x;
    handlePoint.y = pos.y;
}

function endDrag() {
    isDragging = false;
    hasToggledInThisDrag = false;
}

handle.addEventListener('mousedown', startDrag);
window.addEventListener('mousemove', updateDrag);
window.addEventListener('mouseup', endDrag);
handle.addEventListener('touchstart', startDrag, { passive: false });
window.addEventListener('touchmove', updateDrag, { passive: false });
window.addEventListener('touchend', endDrag);

window.addEventListener('resize', () => {
    anchorX = window.innerWidth / 2;
    points[0].x = anchorX;
    points[0].oldX = anchorX;
});

// --- MAIN LOOP ---
function loop() {
    // 1. Update Points
    points.forEach(p => p.update());

    // 2. Resolve Constraints (Sticks) - Multiple iterations for stability
    for (let j = 0; j < CONFIG.stiffness; j++) {
        sticks.forEach(s => s.update());
        
        // Keep anchor fixed
        points[0].x = anchorX;
        points[0].y = anchorY;

        // Keep handle point at cursor if dragging
        if (isDragging) {
            // handlePoint already set in updateDrag, but we re-pin its logic
            // To make the chain follow, we don't let the stick solver move it
            // Simple hack: override its position every sub-iteration
            // (Alternative: Point.isPinned, but we want it pinned only during drag)
        }
    }

    // 3. Toggle Logic
    const restLength = totalLength;
    const distY = handlePoint.y - restLength;
    if (isDragging && distY > CONFIG.threshold && !hasToggledInThisDrag) {
        isLightMode = !isLightMode;
        toggleTheme(isLightMode);
        hasToggledInThisDrag = true;
        if (navigator.vibrate) navigator.vibrate(50);
    }

    // 4. Drawing
    // Draw Rope Path (Spline-like line)
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
        d += ` L ${points[i].x} ${points[i].y}`;
    }
    ropePath.setAttribute('d', d);

    // Draw Handle
    handle.setAttribute('x', handlePoint.x - (CONFIG.handleWidth / 2));
    handle.setAttribute('y', handlePoint.y); // Attach from top of handle

    requestAnimationFrame(loop);
}

function toggleTheme(light) {
    if (light) {
        body.classList.add('light-mode');
        statusTextItalic.textContent = "Dark";
    } else {
        body.classList.remove('light-mode');
        statusTextItalic.textContent = "Light";
    }
}

loop();

