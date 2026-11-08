// npm run serve  ->  http://127.0.0.1:8080/joshs-tacos/
import { createStaticServer } from './static-server.mjs';

const port = Number(process.env.PORT || 8080);
const s = createStaticServer({ root: new URL('../app', import.meta.url).pathname, port });
s.listen().then((url) => console.log(`Serving app/ at ${url}`));
