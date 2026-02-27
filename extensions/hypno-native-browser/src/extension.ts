import * as vscode from 'vscode';

type StringMap = Record<string, string>;

function clip(value: unknown, maxLength: number): string {
	if (typeof value !== 'string') {
		return '';
	}
	return value.length > maxLength ? `${value.slice(0, maxLength)}\n...[truncated]...` : value;
}

function getSelector(data: any): string {
	const tagName = typeof data?.tagName === 'string' && data.tagName.trim().length > 0 ? data.tagName : 'element';
	const firstClass = typeof data?.className === 'string'
		? data.className.trim().split(/\s+/).find((part: string) => part.length > 0) ?? ''
		: '';
	const idSuffix = typeof data?.id === 'string' && data.id.length > 0 ? `#${data.id}` : '';
	const classSuffix = firstClass ? `.${firstClass}` : '';
	return `${tagName}${idSuffix}${classSuffix}`;
}

function toStringMap(value: unknown): StringMap {
	if (!value || typeof value !== 'object') {
		return {};
	}

	const result: StringMap = {};
	for (const [key, rawValue] of Object.entries(value as Record<string, unknown>)) {
		if (typeof rawValue !== 'string') {
			continue;
		}
		const trimmed = rawValue.trim();
		if (trimmed.length > 0) {
			result[key] = clip(trimmed, 320);
		}
	}
	return result;
}

function limitEntries(input: StringMap, maxEntries: number): StringMap {
	const output: StringMap = {};
	for (const [key, value] of Object.entries(input).slice(0, maxEntries)) {
		output[key] = value;
	}
	return output;
}

function selectStylesForHover(allStyles: StringMap): StringMap {
	const preferred = [
		'display',
		'position',
		'color',
		'background-color',
		'font-size',
		'font-weight',
		'font-family',
		'line-height',
		'text-align',
		'border',
		'border-radius',
		'box-sizing'
	];

	const picked: StringMap = {};
	for (const key of preferred) {
		const value = allStyles[key];
		if (typeof value === 'string' && value.trim().length > 0) {
			picked[key] = value.trim();
		}
	}

	if (Object.keys(picked).length === 0) {
		return limitEntries(allStyles, 12);
	}
	return limitEntries(picked, 12);
}

function buildDomPayload(selector: string, data: any): string {
	const cleanedHtml = clip(data?.cleanedHTML, 20000);
	const layoutCss = clip(data?.layoutCSS, 8000);
	const javascriptContext = clip(data?.javascriptContext, 8000);
	const pageUrl = clip(data?.pageUrl, 2048) || 'Unknown URL';
	const pageTitle = clip(data?.pageTitle, 512) || 'Untitled';
	const xpath = clip(data?.xpath, 2048) || 'N/A';
	const domPath = clip(data?.domPath, 2048) || 'N/A';
	const innerText = clip(data?.innerText, 600) || 'N/A';
	const attributes = limitEntries(toStringMap(data?.attributes), 12);

	const lines: string[] = [
		'[[HYPNO_DOM_REFERENCE]]',
		'The user selected this live DOM node from the embedded browser.',
		'Treat this as source-of-truth UI context and map it to existing app code before editing.',
		'',
		`Visible reference: ${selector}`,
		`Page URL: ${pageUrl}`,
		`Page Title: ${pageTitle}`,
		`DOM Path: ${domPath}`,
		`XPath: ${xpath}`,
		`Inner Text: ${innerText}`,
		'',
	];

	if (Object.keys(attributes).length > 0) {
		lines.push('### Key Attributes');
		for (const [key, value] of Object.entries(attributes)) {
			lines.push(`${key}: ${value}`);
		}
		lines.push('');
	}

	lines.push(
		'### HTML',
		cleanedHtml || '(No HTML captured)',
		'',
		'### CSS',
		layoutCss || '(No CSS captured)',
		'',
		'### JavaScript',
		javascriptContext || '(No direct JS handlers captured on this element)',
		'[[/HYPNO_DOM_REFERENCE]]'
	);

	return lines.join('\n');
}

function buildDomHoverData(selector: string, data: any): string {
	const allStyles = toStringMap(data?.computedStyles);
	const attributes = limitEntries(toStringMap(data?.attributes), 12);
	const computedStyles = selectStylesForHover(allStyles);
	const tagName = typeof data?.tagName === 'string' && data.tagName.length > 0 ? data.tagName : 'element';

	const positionSource =
		data?.position && typeof data.position === 'object'
			? (data.position as Record<string, unknown>)
			: {};

	const roundedPosition: Record<string, number> = {};
	for (const key of ['top', 'left', 'width', 'height']) {
		const raw = positionSource[key];
		if (typeof raw === 'number' && Number.isFinite(raw)) {
			roundedPosition[key] = Math.round(raw * 100) / 100;
		}
	}

	const hoverData = {
		selector,
		element: `<${tagName}>`,
		tagName,
		domPath: clip(data?.domPath, 2048) || '',
		xpath: clip(data?.xpath, 2048) || '',
		pageTitle: clip(data?.pageTitle, 512) || '',
		pageUrl: clip(data?.pageUrl, 2048) || '',
		attributes,
		computedStyles,
		position: roundedPosition,
		innerText: clip(data?.innerText, 600) || ''
	};

	return JSON.stringify(hoverData);
}

function buildDomHoverPreview(selector: string, data: any): string {
	const attributes = limitEntries(toStringMap(data?.attributes), 8);
	const allStyles = toStringMap(data?.computedStyles);
	const styles = selectStylesForHover(allStyles);

	const lines: string[] = [
		'ELEMENT',
		selector,
		'',
		'PATH',
		clip(data?.domPath, 1024) || 'N/A',
		''
	];

	if (Object.keys(attributes).length > 0) {
		lines.push('ATTRIBUTES');
		for (const [key, value] of Object.entries(attributes)) {
			lines.push(`${key}: ${value}`);
		}
		lines.push('');
	}

	if (Object.keys(styles).length > 0) {
		lines.push('COMPUTED STYLES');
		for (const [key, value] of Object.entries(styles)) {
			lines.push(`${key}: ${value}`);
		}
		lines.push('');
	}

	const position = data?.position;
	if (position && typeof position === 'object') {
		lines.push('POSITION & SIZE');
		for (const key of ['top', 'left', 'width', 'height']) {
			const raw = (position as Record<string, unknown>)[key];
			if (typeof raw === 'number' && Number.isFinite(raw)) {
				lines.push(`${key}: ${Math.round(raw * 100) / 100}px`);
			}
		}
		lines.push('');
	}

	const innerText = clip(data?.innerText, 320);
	if (innerText) {
		lines.push('INNER TEXT');
		lines.push(innerText);
	}

	return lines.join('\n').trim();
}

export function activate(context: vscode.ExtensionContext) {
	let currentPanel: vscode.WebviewPanel | undefined = undefined;

	const openBrowserCommand = vscode.commands.registerCommand('hypno.openBrowser', async () => {
		if (currentPanel) {
			currentPanel.reveal(vscode.ViewColumn.Active);
			return;
		}

		currentPanel = vscode.window.createWebviewPanel(
			'hypno.browser',
			'Browser',
			vscode.ViewColumn.Active,
			{ enableScripts: true, retainContextWhenHidden: true }
		);

		currentPanel.webview.html = getHtmlForWebview(currentPanel.webview);

		// Notify Main process to show/hide
		currentPanel.onDidChangeViewState((e) => {
			if (e.webviewPanel.active) {
				vscode.commands.executeCommand('_hypno.showBrowser');
			} else {
				vscode.commands.executeCommand('_hypno.hideBrowser');
			}
		});

		currentPanel.onDidDispose(() => {
			vscode.commands.executeCommand('_hypno.hideBrowser');
			currentPanel = undefined;
		});

		// Handle messages from Webview (actions and bounds)
		currentPanel.webview.onDidReceiveMessage((message: any) => {
			if (message.command === 'updateBounds') {
				vscode.commands.executeCommand('_hypno.updateBrowserBounds', message.bounds);
			} else if (message.command === 'browserAction') {
				vscode.commands.executeCommand('_hypno.browserAction', message.action);
			}
		});

		// Show initially with a default URL
		vscode.commands.executeCommand('_hypno.showBrowser', { url: 'https://google.com' });
	});

	context.subscriptions.push(openBrowserCommand);

	// Handle element selected from Native Browser → inject into Continue input as an inline DOM pill
	context.subscriptions.push(
			vscode.commands.registerCommand('hypno.browser.onElementSelected', async (data: any) => {
				const selector = getSelector(data);
				const hiddenContent = buildDomPayload(selector, data);
				const hoverData = buildDomHoverData(selector, data);
				const hoverPreview = buildDomHoverPreview(selector, data);
				const referenceId = `hypno-dom://${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

				try {
				// Ensure Continue is activated before invoking the internal DOM-reference command.
				await vscode.commands.executeCommand('continue.focusContinueInputWithoutClear');

					await vscode.commands.executeCommand('continue.hypnoAddDomReference', {
						referenceId,
						label: selector,
						hiddenContent,
						hoverData,
						hoverPreview,
						renderInlineAs: selector
					});
				} catch (e) {
				console.error('[Hypno] Failed to inject DOM pill context into Continue:', e);
			}
		})
	);

	// Phase 2: Handle URL updates from Main Process
	context.subscriptions.push(
		vscode.commands.registerCommand('hypno.browser.onNavigate', (url: string) => {
			if (currentPanel) {
				currentPanel.webview.postMessage({ command: 'updateUrl', url });
			}
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('hypno.browser.onLoadingState', (isLoading: boolean) => {
			if (currentPanel) {
				currentPanel.webview.postMessage({ command: 'updateLoadingState', isLoading });
			}
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('hypno.browser.onInspectDisabled', () => {
			if (currentPanel) {
				currentPanel.webview.postMessage({ command: 'inspectDisabled' });
			}
		})
	);
}

function getHtmlForWebview(_webview: vscode.Webview): string {
	return `
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src vscode-resource: https: data:; script-src 'unsafe-inline'; style-src 'unsafe-inline';">
	<style>
		:root {
			--toolbar-height: 40px;
		}
		body, html {
			margin: 0; padding: 0; height: 100%; width: 100%; overflow: hidden;
			background: transparent; font-family: var(--vscode-font-family);
		}
		#address-bar {
			height: var(--toolbar-height);
			background: var(--vscode-editor-background);
			display: flex; align-items: center; padding: 0 12px; gap: 8px;
			border-bottom: 1px solid var(--vscode-widget-border);
			box-sizing: border-box;
			position: relative;
		}
		#loading-bar {
			position: absolute;
			bottom: 0; left: 0; width: 100%; height: 2px;
			background: transparent;
			overflow: hidden;
		}
		#loading-bar::after {
			content: '';
			display: block;
			width: 30%; height: 100%;
			background: var(--vscode-progressBar-background);
			position: relative;
			transform: translateX(-100%);
			opacity: 0;
			transition: opacity 0.2s;
		}
		#loading-bar.is-loading::after {
			opacity: 1;
			animation: loading 1.5s infinite ease-in-out;
		}
		@keyframes loading {
			0% { transform: translateX(-100%); }
			100% { transform: translateX(350%); }
		}
		button {
			background: transparent; border: none; color: var(--vscode-icon-foreground);
			cursor: pointer; height: 28px; width: 28px; border-radius: 4px; display: flex;
			align-items: center; justify-content: center; padding: 0;
		}
		button:hover { background: var(--vscode-toolbar-hoverBackground); }
		button.active { background: var(--vscode-toolbar-hoverBackground); color: var(--vscode-button-foreground); }
		.spin { animation: spin 1s linear infinite; }
		@keyframes spin { 100% { transform: rotate(360deg); } }
		svg { width: 16px; height: 16px; }
		#url-input {
			flex: 1; height: 26px; background: var(--vscode-input-background);
			color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border);
			border-radius: 4px; padding: 0 8px; font-size: 13px; outline: none;
		}
		#url-input:focus { border-color: var(--vscode-focusBorder); }
		#placeholder {
			height: calc(100vh - var(--toolbar-height));
			width: 100%; background: transparent;
		}
	</style>
</head>
<body>
	<div id="address-bar">
		<button id="btn-back" title="Go Back">
			<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
		</button>
		<button id="btn-forward" title="Go Forward">
			<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>
		</button>
		<button id="btn-reload" title="Reload">
			<svg id="icon-reload" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21v-5h5"/></svg>
		</button>
		<input type="text" id="url-input" value="https://google.com" placeholder="Enter URL..." />
		<button id="btn-inspect" title="Click Reference (Inspect)">
			<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/><path d="M13 13l6 6"/></svg>
		</button>
		<button id="btn-external" title="Open in External Browser">
			<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
		</button>
		<div id="loading-bar"></div>
	</div>
	<div id="placeholder"></div>

	<script>
		const vscode = acquireVsCodeApi();

		// UI Actions
		document.getElementById('btn-back').addEventListener('click', () => vscode.postMessage({ command: 'browserAction', action: { type: 'go-back' } }));
		document.getElementById('btn-forward').addEventListener('click', () => vscode.postMessage({ command: 'browserAction', action: { type: 'go-forward' } }));
		document.getElementById('btn-reload').addEventListener('click', () => vscode.postMessage({ command: 'browserAction', action: { type: 'reload' } }));
		document.getElementById('btn-external').addEventListener('click', () => vscode.postMessage({ command: 'browserAction', action: { type: 'open-external', url: document.getElementById('url-input').value } }));
		document.getElementById('btn-inspect').addEventListener('click', () => {
			const btn = document.getElementById('btn-inspect');
			btn.classList.toggle('active');
			vscode.postMessage({ command: 'browserAction', action: { type: 'inspect' } });
		});

		document.getElementById('url-input').addEventListener('keydown', (e) => {
			if (e.key === 'Enter') {
				vscode.postMessage({ command: 'browserAction', action: { type: 'load-url', url: e.target.value } });
			}
		});

		window.addEventListener('message', event => {
			const message = event.data;
			if (message.command === 'updateUrl') {
				document.getElementById('url-input').value = message.url;
			} else if (message.command === 'updateLoadingState') {
				const bar = document.getElementById('loading-bar');
				const icon = document.getElementById('icon-reload');
				if (message.isLoading) {
					bar.classList.add('is-loading');
					icon.classList.add('spin');
				} else {
					bar.classList.remove('is-loading');
					icon.classList.remove('spin');
				}
			} else if (message.command === 'inspectDisabled') {
				document.getElementById('btn-inspect').classList.remove('active');
			}
		});
	</script>
</body>
</html>
	`;
}
