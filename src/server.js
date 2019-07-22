const express = require('express');
const path = require('path');
const app = express();
const React = require('react');
const { renderToString } = require('react-dom/server');
const { createStore } = require('redux');
const { Provider } = require('react-redux');
let App = require('./components/app.js').default;
const bodyParser = require('body-parser');
const Axios = require('axios');
const { getProductInfo, getStyles, getRelated, getQA, getReviews, getMeta } = require('./infoFetchers');
const rootReducer = require("./reducers/main").default;
const expressStaticGzip = require("express-static-gzip");



const port = process.env.PORT || 8866;

app.use(bodyParser.json());

app.use('/', expressStaticGzip(path.join(__dirname, '../dist'), {
  enableBrotli: true,
  orderPreference: ['br', 'gz'],
  setHeaders: function (res, path) {
     res.setHeader("Cache-Control", "public, max-age=31536000");
  }
}));

// app.use(express.static(path.join(__dirname, '../dist')));

const handleRender = (req, res) => {
  let productId = parseInt(req.query.products);
  if (productId !== undefined || !isNaN(productId)) {
    Axios.all([getProductInfo(productId), 
      getStyles(productId), 
      getRelated(productId), 
      getQA(productId), 
      getReviews(productId), 
      getMeta(productId)])
    .then(Axios.spread((infoResponse, stylesResponse, relatedResponse, qaResponse, reviewsResponse, metaResponse) => {
      const store = createStore(
        rootReducer, {
          overviewProductInfo: infoResponse.data,
          overviewChangeStyles: stylesResponse.data,
          overviewChangeSelectedStyles: stylesResponse.data.results[0],
          related: relatedResponse.data,
          qaResultsArr: qaResponse.data.results,
          reviews: reviewsResponse.data,
          meta: metaResponse.data
      });
      const html = renderToString(
        <Provider store={store}>
          <App />
        </Provider>
      );
      const finalState = store.getState();
      res.send(renderFullPage(html, finalState)); 
    }))
    .catch((err) => {
      console.error(err);
      res.sendStatus(500)})
    } else {
      res.sendStatus(404);
    }
};

function renderFullPage(html, preloadedState) {
  return `
    <!doctype html>
    <html>
      <head>
        <title>Project Greenfield</title>
      </head>
      <body>
        <div id="app">${html}</div>
        <script>
          window.__PRELOADED_STATE__ = ${JSON.stringify(preloadedState)}
        </script>
        <script src="bundle.js"></script>
      </body>
    </html>
    `
}

app.get('/favicon', (req, res) => {
  res.sendStatus(404);
});

app.get('/', handleRender);

app.listen(port, () => {
  console.log('Listening on ', port)
});