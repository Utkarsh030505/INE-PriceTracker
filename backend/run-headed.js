import { scrapeTrackedProduct } from './scraper.js';

const url = process.argv[2] || 'https://demo.inelabteamdev.com/product/1';

const fakeProduct = {
  id: 'demo',
  product_name: 'Demo Product',
  product_url: url,
};

console.log('SCRAPE STARTED');
console.log(`Target: ${url}\n`);

const log = (msg) => {
  console.log(msg);
};

try {
  const result = await scrapeTrackedProduct(fakeProduct, { headed: true, onLog: log });

  console.log('\n------------------------');
  if (result.success) {
    console.log('Result: SUCCESS');
    console.log(`Product: ${result.productName}`);
    console.log(`Price:   ₹${result.price}`);
    console.log(`Stock:   ${result.stock}`);
  } else {
    console.log('Result: FAILED');
    console.log('All attempts exhausted.');
  }
  console.log('------------------------');
} catch (err) {
  console.error('Fatal error:', err.message);
  process.exit(1);
}
