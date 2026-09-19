import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001',
});

export async function searchProducts(query) {
  const { data } = await api.get('/api/products/search', { params: { q: query } });
  return data;
}

export async function getTrackedProducts() {
  const { data } = await api.get('/api/products/tracked');
  return data;
}

export async function trackProduct(productName, productUrl) {
  const { data } = await api.post('/api/products/track', {
    product_name: productName,
    product_url: productUrl,
  });
  return data;
}

export async function getProduct(id) {
  const { data } = await api.get(`/api/products/${id}`);
  return data;
}

export async function getProductHistory(id) {
  const { data } = await api.get(`/api/products/${id}/history`);
  return data;
}

export async function getProductLogs(id) {
  const { data } = await api.get(`/api/products/${id}/logs`);
  return data;
}

export async function scrapeProduct(id) {
  const { data } = await api.post(`/api/products/${id}/scrape`);
  return data;
}

export async function deleteProduct(id) {
  const { data } = await api.delete(`/api/products/${id}`);
  return data;
}
