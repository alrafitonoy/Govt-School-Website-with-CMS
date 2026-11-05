// Entry file. Hostinger's web server (LiteSpeed, through lsnode.js) loads this with require(), so it has
// three rules: no top-level await here, listen immediately and only once, and load everything else with import().
import http from 'node:http';

const [major, minor] = process.versions.node.split('.').map(Number);

const textReply = (message) => (req, res) => {
  res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'Retry-After': '5' });
  res.end(message);
};

let handler = textReply('The site is starting. Please refresh in a few seconds.');
const setHandler = (next) => { handler = next; };

http.createServer((req, res) => handler(req, res)).listen(Number(process.env.PORT || 5000));

if (major > 22 || (major === 22 && minor >= 12)) {
  import('./server/src/index.js')
    .then(({ start }) => start(setHandler))
    .catch((err) => {
      console.error('The site could not start:', err);
      setHandler(textReply('The site could not start. Please check the runtime logs in the Hostinger dashboard.'));
    });
} else {
  // A package this site needs for security cannot load below Node 22.12.
  const message = `This website needs Node.js 22.12 or newer, but this server is running ${process.version}. `
    + 'In the Hostinger dashboard, open this website\'s Node.js settings, choose version 24, and deploy again.';
  console.error(message);
  setHandler(textReply(message));
}
