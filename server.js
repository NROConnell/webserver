const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

let visitorCount = 0;

const adviceList = [
    "Keep your code DRY (Don't Repeat Yourself).",
    "Use meaningful variable names.",
    "Comment your code for better readability.",
    "Break down complex problems into smaller, manageable tasks.",
    "Test your code thoroughly before deployment."
];

const catFacts = [
    "Cats have five toes on their front paws, but only four toes on their back paws.",
    "A group of cats is called a clowder.",
    "Cats can make over 100 different sounds.",
    "The world's largest cat measured 48.5 inches long.",
    "Cats sleep for 70% of their lives."
];

const seaLifeFacts = [
    "Octopuses have three hearts.",
    "A group of jellyfish is called a smack.",
    "Sea turtles can breathe through their butts.",
    "The heart of a shrimp is located in its head.",
    "Some species of fish can change their gender."
];

const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.mp4': 'video/mp4',
    '.json': 'application/json',
    '.ico': 'image/x-icon'
};

http.createServer((req, res) => {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const reqPath = parsedUrl.pathname;

    if (reqPath === '/roll') {
        console.log("/roll route accessed");
        let roll = Math.floor(Math.random() * 6) + 1;
        console.log(`Roll: ${roll}`);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        return res.end(`<h1>Roll: ${roll}</h1>`);
    }

    // Route Normalization: Map root to index.html & append .html to extensionless routes
    let normalizedPath = reqPath === '/' ? '/index.html' : reqPath;
    if (!path.extname(normalizedPath)) {
        normalizedPath += '.html';
    }

    const filePath = path.join(PUBLIC_DIR, normalizedPath);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'text/plain';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/html' });
            return res.end('<h1>404: Page Not Found</h1>');
        }

        let finalContent = content;

        if (ext === '.html') {

            let randomAdvice = adviceList[Math.floor(Math.random() * adviceList.length)];
            console.log(randomAdvice);

            let randomCatFact = catFacts[Math.floor(Math.random() * catFacts.length)];
            console.log(randomCatFact);

            let randomSeaLifeFact = seaLifeFacts[Math.floor(Math.random() * seaLifeFacts.length)];
            console.log(randomSeaLifeFact);

            // Track visits to the home page
            if (normalizedPath === '/index.html') {
                visitorCount++;
                console.log(`[VISIT #${visitorCount}] Connection from: ${req.socket.remoteAddress}`);
            }

            // Server-Driven Theme Handling
            const theme = parsedUrl.searchParams.get('theme') === 'dark' ? 'dark-mode' : 'light-mode';

            // Replace template placeholders in HTML files
            finalContent = content.toString()
                .replace('{{COUNT}}', String(visitorCount))
                .replace('{{THEME_CLASS}}', theme)
                .replace('{{FACT}}', randomAdvice)
                .replace('{{CAT_FACT}}', randomCatFact)
                .replace('{{SEA_LIFE_FACT}}', randomSeaLifeFact);
        }

        console.log(`[REQUEST] ${req.socket.remoteAddress} accessed ${normalizedPath}`);
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(finalContent);
    });
}).listen(PORT, '0.0.0.0', () => {
    console.log(`Server live! Listening on port http://localhost:${PORT}...`);
});