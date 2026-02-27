const vscode = require('vscode');

async function activate(context) {
    console.log("Activating test extension");
    setTimeout(async () => {
        try {
            await vscode.commands.executeCommand('continue.addModelContext', {
                name: "Test",
                description: "Test description",
                content: "Test content",
                id: {
                    providerTitle: "browser",
                    itemId: "test"
                }
            });
            console.log("Command executed successfully!");
        } catch(e) {
            console.error("Command failed", e);
        }
    }, 2000);
}
exports.activate = activate;
