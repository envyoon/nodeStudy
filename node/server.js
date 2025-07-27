const http = require('http');

const server = http.createServer((req, res) => {
  res.end('hello from native http');
});

server.listen(3000, () => {
  console.log('Native HTTP Server listening on port 3000');
});