const fs = require('fs');
const path = require('path');

const ASSETS_DIR = '/Users/sudonym/cyanide-assets';
const V4_GAMES_DIR = '/Users/sudonym/cyanide-v4/public/games';
const GITHUB_REPO = 'https://cdn.jsdelivr.net/gh/sudonym-sudo/cyanide-assets@main/';

function walkSync(currentDirPath, callback) {
    fs.readdirSync(currentDirPath).forEach((name) => {
        const filePath = path.join(currentDirPath, name);
        const stat = fs.statSync(filePath);
        if (stat.isFile()) {
            callback(filePath, stat);
        } else if (stat.isDirectory() && name !== '.git' && name !== 'node_modules') {
            walkSync(filePath, callback);
        }
    });
}

function processFiles() {
    let htmlCount = 0;
    let jsonCount = 0;

    walkSync(ASSETS_DIR, (filePath) => {
        const fileName = path.basename(filePath).toLowerCase();
        
        // Handle HTML files
        if (fileName === 'index.html' || fileName === 'balatro.html') {
            // Calculate relative path from ASSETS_DIR
            const relativePath = path.relative(ASSETS_DIR, filePath);
            const relativeDir = path.dirname(relativePath);
            
            // Skip files in the root directory (if any) to avoid messing up main repo files
            if (relativeDir === '.') return;

            // Prepare destination path
            const destPath = path.join(V4_GAMES_DIR, relativePath);
            const destDir = path.dirname(destPath);
            
            // Create destination directory if it doesn't exist
            if (!fs.existsSync(destDir)) {
                fs.mkdirSync(destDir, { recursive: true });
            }

            // Read HTML content
            let content = fs.readFileSync(filePath, 'utf8');
            
            // Base URL for this specific game
            // relativeDir might contain backslashes on Windows, ensure forward slashes
            const posixRelativeDir = relativeDir.split(path.sep).join('/');
            const baseUrl = `${GITHUB_REPO}${posixRelativeDir}/`;

            // Remove existing base tag if any
            content = content.replace(/<base\s+[^>]*>/gi, '');

            // Inject new base tag
            const baseTag = `<base href="${baseUrl}">`;
            if (content.match(/<head>/i)) {
                content = content.replace(/(<head>)/i, `$1\n    ${baseTag}`);
            } else if (content.match(/<html[^>]*>/i)) {
                content = content.replace(/(<html[^>]*>)/i, `$1\n<head>\n    ${baseTag}\n</head>`);
            } else {
                content = `${baseTag}\n${content}`;
            }

            // Write modified HTML to new location
            fs.writeFileSync(destPath, content, 'utf8');
            
            // Delete original HTML
            fs.unlinkSync(filePath);
            htmlCount++;
        }
        
        // Handle meta.json / metadata.json
        if (fileName === 'meta.json' || fileName === 'metadata.json') {
            try {
                const content = fs.readFileSync(filePath, 'utf8');
                const data = JSON.parse(content);
                
                let modified = false;
                if (data.src) {
                    delete data.src;
                    modified = true;
                }
                
                if (modified) {
                    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
                    jsonCount++;
                }
            } catch (e) {
                console.error(`Error processing JSON at ${filePath}:`, e);
            }
        }
    });

    console.log(`Successfully moved and injected base tags into ${htmlCount} HTML files.`);
    console.log(`Successfully removed 'src' field from ${jsonCount} metadata files.`);
}

processFiles();
