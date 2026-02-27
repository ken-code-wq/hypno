const { contextBridge, ipcRenderer } = require('electron');

let isInspectMode = false;
let isAltPreviewMode = false;
let inspectStyle = null;
let overlayWrapper = null;
let overlayBox = null;
let overlayBadge = null;
let hoveredElement = null;
let isTrackingMouse = false;

function isOverlayActive() {
	return isInspectMode || isAltPreviewMode;
}

function syncOverlayTracking() {
	if (isOverlayActive()) {
		createOverlay();
		window.addEventListener('mousemove', onMouseMove, { capture: true, passive: true });
		return;
	}

	hoveredElement = null;
	isTrackingMouse = false;
	window.removeEventListener('mousemove', onMouseMove, { capture: true });
	removeOverlay();
}

function createOverlay() {
	if (overlayWrapper) return;

	overlayWrapper = document.createElement('div');
	overlayWrapper.id = 'hypno-inspector-overlay';
	Object.assign(overlayWrapper.style, {
		position: 'fixed',
		pointerEvents: 'none',
		zIndex: '2147483647', // Max z-index
		display: 'none'
	});

	overlayBox = document.createElement('div');
	overlayBox.className = 'hypno-box';
	Object.assign(overlayBox.style, {
		width: '100%',
		height: '100%',
		backgroundColor: 'rgba(59, 130, 246, 0.2)', // Tailwind blue-500 @ 20%
		// border: '2px solid rgba(59, 130, 246, 0.8)',
		border: '2px dashed rgba(59, 130, 246, 0.8)',
		borderRadius: '8px',
		boxSizing: 'border-box',
		pointerEvents: 'none',
		boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
		// backdropFilter: 'blur(1px)' // Subtle glassmorphism on inspected item
	});

	overlayBadge = document.createElement('div');
	overlayBadge.id = 'hypno-inspector-badge';
	Object.assign(overlayBadge.style, {
		position: 'absolute',
		bottom: '100%',
		right: '-2px',
		backgroundColor: 'rgba(59, 130, 246, 1)',
		color: 'white',
		padding: '4px 8px', // slightly thicker padding
		fontSize: '12px',
		fontWeight: '600',
		fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
		borderTopLeftRadius: '6px',
		borderTopRightRadius: '6px',
		whiteSpace: 'nowrap',
		pointerEvents: 'none',
		boxShadow: '0 -2px 8px rgba(59, 130, 246, 0.4)'
	});

	overlayWrapper.appendChild(overlayBox);
	overlayWrapper.appendChild(overlayBadge);
	document.body.appendChild(overlayWrapper);

	const styleId = 'hypno-inspector-animations';
	if (!document.getElementById(styleId)) {
		const animStyle = document.createElement('style');
		animStyle.id = styleId;
		animStyle.textContent = `
			@keyframes hypnoPulse {
				0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4); }
				70% { box-shadow: 0 0 0 8px rgba(59, 130, 246, 0); }
				100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
			}
			#hypno-inspector-overlay .hypno-box {
				animation: hypnoPulse 2s infinite;
			}
		`;
		document.head.appendChild(animStyle);
	}
}

function removeOverlay() {
	if (overlayWrapper) {
		overlayWrapper.remove();
		overlayWrapper = null;
		overlayBox = null;
		overlayBadge = null;
	}
	const animStyle = document.getElementById('hypno-inspector-animations');
	if (animStyle) animStyle.remove();
}

function updateOverlayPosition(clientX, clientY) {
	if (!isOverlayActive() || !overlayWrapper) {
		isTrackingMouse = false;
		return;
	}

	const el = document.elementFromPoint(clientX, clientY);
	if (!el || el === hoveredElement || el === overlayWrapper || el.id === 'hypno-inspector-overlay') {
		isTrackingMouse = false;
		return;
	}

	hoveredElement = el;

	overlayWrapper.style.display = 'block';

	// Add transition AFTER the first display unhide, so it doesn't animate from 0,0
	if (!overlayWrapper.style.transition) {
		requestAnimationFrame(() => {
			if (overlayWrapper) overlayWrapper.style.transition = 'all 0.15s cubic-bezier(0.2, 0.8, 0.2, 1)';
		});
	}

	const rect = el.getBoundingClientRect();

	overlayWrapper.style.left = `${rect.left}px`;
	overlayWrapper.style.top = `${rect.top}px`;
	overlayWrapper.style.width = `${rect.width}px`;
	overlayWrapper.style.height = `${rect.height}px`;
	overlayBadge.innerText = el.tagName.toLowerCase();

	isTrackingMouse = false;
}

function onMouseMove(e) {
	if (!isOverlayActive()) return;
	if (!isTrackingMouse) {
		isTrackingMouse = true;
		const clientX = e.clientX;
		const clientY = e.clientY;
		requestAnimationFrame(() => updateOverlayPosition(clientX, clientY));
	}
}

ipcRenderer.on('hypno-toggle-inspect', () => {
	isInspectMode = !isInspectMode;
	if (isInspectMode) {
		inspectStyle = document.createElement('style');
		inspectStyle.textContent = '* { cursor: crosshair !important; }';
		document.head.appendChild(inspectStyle);
		syncOverlayTracking();
	} else {
		if (inspectStyle) {
			inspectStyle.remove();
			inspectStyle = null;
		}
		syncOverlayTracking();
	}
});

window.addEventListener('keydown', (e) => {
	if (e.key === 'Alt' && !isAltPreviewMode) {
		isAltPreviewMode = true;
		syncOverlayTracking();
		return;
	}

	if (e.key === 'Escape' && isInspectMode) {
		isInspectMode = false;
		if (inspectStyle) {
			inspectStyle.remove();
			inspectStyle = null;
		}
		syncOverlayTracking();
		ipcRenderer.send('vscode:hypno-browser-inspect-disabled');
	}
});

window.addEventListener('keyup', (e) => {
	if (e.key !== 'Alt' || !isAltPreviewMode) return;
	isAltPreviewMode = false;
	syncOverlayTracking();
});

window.addEventListener('blur', () => {
	if (!isAltPreviewMode) return;
	isAltPreviewMode = false;
	syncOverlayTracking();
});

// Phase 2: The Cleaner Recursive Function
function cleanElement(node) {
	if (node.nodeType === Node.TEXT_NODE) {
		let text = node.textContent;
		if (text && text.trim().length > 0) {
			if (text.length > 500) text = text.substring(0, 500) + '...';
			return document.createTextNode(text);
		}
		return null;
	}

	if (node.nodeType !== Node.ELEMENT_NODE) return null;

	const clone = node.cloneNode(false); // shallow clone

	// Remove React noise and useless attributes
	const attrsToRemove = [];
	for (let i = 0; i < clone.attributes.length; i++) {
		const attr = clone.attributes[i];
		if (attr.name.startsWith('data-react') || attr.name.startsWith('data-v-')) {
			attrsToRemove.push(attr.name);
		}
	}
	attrsToRemove.forEach(attr => clone.removeAttribute(attr));

	if (clone.tagName.toLowerCase() === 'svg') {
		clone.innerHTML = '...'; // Nuke massive inner paths
		return clone;
	}

	for (let i = 0; i < node.childNodes.length; i++) {
		const child = node.childNodes[i];
		const cleanedChild = cleanElement(child);
		if (cleanedChild) clone.appendChild(cleanedChild);
	}

	return clone;
}

function getRelevantStyles(el) {
	const styles = window.getComputedStyle(el);
	const relevant = {};
	const layoutProps = [
		'display', 'flex-direction', 'justify-content', 'align-items', 'gap',
		'grid-template-columns', 'grid-template-rows',
		'position', 'top', 'right', 'bottom', 'left',
		'width', 'height', 'max-width', 'max-height', 'min-width', 'min-height',
		'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
		'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
		'box-sizing', 'overflow-x', 'overflow-y'
	];
	const typographyProps = [
		'color', 'background-color', 'font-size', 'font-weight', 'line-height',
		'text-align', 'letter-spacing', 'border-radius', 'border', 'opacity'
	];

	for (const prop of [...layoutProps, ...typographyProps]) {
		const val = styles.getPropertyValue(prop);
		if (val && val !== 'none' && val !== '0px' && val !== 'normal' && val !== 'auto' && val !== 'rgba(0, 0, 0, 0)') {
			relevant[prop] = val;
		}
	}
	return relevant;
}

function getJavascriptContext(el) {
	const inlineHandlers = [];
	const frameworkHandlers = [];

	for (const attr of Array.from(el.attributes || [])) {
		if (attr.name.startsWith('on') && attr.value && attr.value.trim().length > 0) {
			inlineHandlers.push(`${attr.name}="${attr.value.trim()}"`);
		}
	}

	try {
		const reactPropsKey = Object.keys(el).find((key) => key.startsWith('__reactProps$'));
		if (reactPropsKey) {
			const reactProps = el[reactPropsKey];
			if (reactProps && typeof reactProps === 'object') {
				for (const [key, value] of Object.entries(reactProps)) {
					if (key.startsWith('on') && typeof value === 'function') {
						frameworkHandlers.push(`React.${key}`);
					}
				}
			}
		}
	} catch {
		// Ignore framework internals that throw during reflective access.
	}

	if (Object.keys(el).some((key) => key.startsWith('__vueParentComponent'))) {
		frameworkHandlers.push('Vue component context detected');
	}

	const scriptUrls = Array.from(document.querySelectorAll('script[src]'))
		.map((script) => script.getAttribute('src'))
		.filter((src) => typeof src === 'string' && src.length > 0)
		.slice(0, 8);

	const lines = [];
	if (inlineHandlers.length > 0) {
		lines.push(`Inline handlers: ${inlineHandlers.join(', ')}`);
	}
	if (frameworkHandlers.length > 0) {
		lines.push(`Framework handlers: ${frameworkHandlers.join(', ')}`);
	}
	if (scriptUrls.length > 0) {
		lines.push('Page scripts:');
		for (const src of scriptUrls) {
			lines.push(`- ${src}`);
		}
	}

	return lines.join('\n');
}

function getElementAttributes(el) {
	const attrs = {};
	const prioritized = new Set([
		'id',
		'class',
		'href',
		'src',
		'alt',
		'role',
		'name',
		'type',
		'value',
		'aria-label',
		'title'
	]);

	for (const attr of Array.from(el.attributes || [])) {
		const key = attr.name;
		const value = attr.value ? attr.value.trim() : '';
		if (!value) continue;

		if (prioritized.has(key) || key.startsWith('data-') || key.startsWith('aria-')) {
			attrs[key] = value;
		}

		if (Object.keys(attrs).length >= 14) {
			break;
		}
	}

	return attrs;
}

function getDomPath(element, maxDepth = 7) {
	if (!(element instanceof Element)) return '';

	const parts = [];
	let current = element;

	while (current && parts.length < maxDepth) {
		let part = current.tagName.toLowerCase();
		if (current.id) {
			part += `#${current.id}`;
		} else if (typeof current.className === 'string' && current.className.trim()) {
			const classPart = current.className.trim().split(/\s+/)[0];
			if (classPart) {
				part += `.${classPart}`;
			}
		}
		parts.unshift(part);

		if (current.parentElement && current.parentElement.children) {
			const siblings = Array.from(current.parentElement.children).filter(
				sibling => sibling.tagName === current.tagName
			);
			if (siblings.length > 1) {
				const index = siblings.indexOf(current) + 1;
				if (index > 0) {
					parts[0] += `[${index}]`;
				}
			}
		}

		current = current.parentElement;
	}

	return parts.join(' > ');
}

function getInnerTextPreview(el) {
	const text = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
	if (!text) return '';
	return text.length > 420 ? `${text.slice(0, 420)}...` : text;
}

function getXPath(element) {
	if (!element || element.nodeType !== Node.ELEMENT_NODE) return '';
	if (element.id !== '') {
		return `//*[@id='${element.id}']`;
	}
	if (element === document.body) {
		return '/html/body';
	}
	let ix = 0;
	const siblings = element.parentNode ? element.parentNode.childNodes : [];
	for (let i = 0; i < siblings.length; i++) {
		const sibling = siblings[i];
		if (sibling === element) {
			const parentPath = getXPath(element.parentNode);
			return `${parentPath}/${element.tagName.toLowerCase()}['${ix + 1}']`;
		}
		if (sibling.nodeType === Node.ELEMENT_NODE && sibling.tagName === element.tagName) {
			ix++;
		}
	}
	return '';
}

const blockEvent = (e) => {
	if ((e.altKey && e.button === 0) || (isInspectMode && e.button === 0)) {
		e.preventDefault();
		e.stopPropagation();
		e.stopImmediatePropagation();
	}
};

window.addEventListener('mousedown', blockEvent, { capture: true, passive: false });
window.addEventListener('mouseup', blockEvent, { capture: true, passive: false });
window.addEventListener('pointerdown', blockEvent, { capture: true, passive: false });
window.addEventListener('pointerup', blockEvent, { capture: true, passive: false });
window.addEventListener('dblclick', blockEvent, { capture: true, passive: false });

window.addEventListener('click', (e) => {
	// Alt + Left Click OR Inspect Mode + Left Click
	if ((e.altKey && e.button === 0) || (isInspectMode && e.button === 0)) {
		e.preventDefault();
		e.stopPropagation();
		e.stopImmediatePropagation();

		if (isInspectMode) {
			isInspectMode = false;
			if (inspectStyle) {
				inspectStyle.remove();
				inspectStyle = null;
			}
			syncOverlayTracking();
			ipcRenderer.send('vscode:hypno-browser-inspect-disabled');
		}

		const el = e.target;
		if (!(el instanceof Element)) return;

		// Extract a clean version of the target element
		const cleanedClone = cleanElement(el);
		let html = cleanedClone ? cleanedClone.outerHTML : '';

		const rawCss = getRelevantStyles(el);
		const cssString = Object.entries(rawCss).map(([k, v]) => `${k}: ${v};`).join(' ');
		const rect = el.getBoundingClientRect();

		const data = {
			tagName: el.tagName.toLowerCase(),
			className: typeof el.className === 'string' ? el.className.trim() : '',
			id: el.id || '',
			domPath: getDomPath(el),
			xpath: getXPath(el),
			attributes: getElementAttributes(el),
			cleanedHTML: html,
			layoutCSS: cssString,
			computedStyles: rawCss,
			position: {
				top: Math.round(rect.top * 100) / 100,
				left: Math.round(rect.left * 100) / 100,
				width: Math.round(rect.width * 100) / 100,
				height: Math.round(rect.height * 100) / 100
			},
			innerText: getInnerTextPreview(el),
			pageUrl: window.location.href,
			pageTitle: document.title,
			javascriptContext: getJavascriptContext(el)
		};

		ipcRenderer.send('hypno-browser-reference', data);
	}
}, { capture: true, passive: false });
