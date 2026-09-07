#!/usr/bin/env node
/**
 * Comprehensive API test script - tests all major endpoints against both
 * localhost dev server and Vercel deployment.
 * 
 * Usage:
 *   node test-all-apis.mjs                    # Test localhost:3000
 *   node test-all-apis.mjs --vercel          # Test vercel deployment
 */

const LOCALHOST = 'http://localhost:3000';
const VERCEL = 'https://qr-ordering-sable.vercel.app';
const BASE_URL = process.argv.includes('--vercel') ? VERCEL : LOCALHOST;

console.log(`🧪 Testing API endpoints at: ${BASE_URL}`);
console.log('=' .repeat(60));

async function apiCall(method, path, body = null) {
  const url = `${BASE_URL}${path}`;
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) options.body = JSON.stringify(body);

  try {
    const res = await fetch(url, options);
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    console.log(`${method.padEnd(6)} ${path.padEnd(25)} → ${res.status} ${res.statusText}`);
    if (!res.ok) {
      console.log(`   ❌ Error: ${JSON.stringify(data, null, 2)}`);
      return null;
    }
    
    console.log(`   ✅ Success`);
    return data;
  } catch (err) {
    console.log(`${method.padEnd(6)} ${path.padEnd(25)} → ❌ ${err.message}`);
    return null;
  }
}

async function runTests() {
  console.log('\n📊 Core Info Endpoints:');
  await apiCall('GET', '/api/cafe');
  await apiCall('GET', '/api/tables');
  await apiCall('GET', '/api/categories');
  await apiCall('GET', '/api/menu');
  await apiCall('GET', '/api/orders');

  console.log('\n🏪 Table Management:');
  const table = await apiCall('POST', '/api/tables', {
    number: 'Test Table 99',
    capacity: 4,
    status: 'available'
  });

  console.log('\n🏷️  Category Management:');
  const category = await apiCall('POST', '/api/categories', {
    name: 'Test Category',
    icon: 'TestIcon'
  });

  console.log('\n🍽️  Menu Item Management:');
  const menuItem = await apiCall('POST', '/api/menu', {
    name: 'Test Item',
    description: 'A test menu item',
    price: 199,
    categoryId: category?.id || 'cat-test',
    vegType: 'veg',
    image: '',
    isAvailable: true,
    preparationTimeMin: 10
  });

  console.log('\n🧾 Order Management:');
  const order = await apiCall('POST', '/api/orders', {
    tableId: table?.id || 'table-test',
    tableNumber: 'Test Table',
    items: [{
      itemId: 'test-item-1',
      menuItemId: menuItem?.id,
      name: 'Test Item',
      price: 199,
      vegType: 'veg',
      quantity: 1,
      itemTotal: 199,
      selectedCustomizations: [],
      specialInstructions: 'Test order'
    }],
    subtotal: 199,
    tax: 0,
    serviceCharge: 0,
    total: 199,
    customerName: 'Test Customer',
    paymentMethod: 'counter_cash',
    paymentStatus: 'pending'
  });

  // Test order status updates if order was created
  if (order?.id) {
    console.log('\n🔄 Order Status Updates:');
    await apiCall('PATCH', `/api/orders/${order.id}/status`, { status: 'preparing' });
    await apiCall('PATCH', `/api/orders/${order.id}/status`, { status: 'ready' });
    await apiCall('PATCH', `/api/orders/${order.id}/status`, { status: 'served' });
  }

  console.log('\n📚 API Documentation:');
  await apiCall('GET', '/api/docs-json');

  console.log('\n' + '='.repeat(60));
  console.log(`✅ Test completed for ${BASE_URL}`);
  
  if (BASE_URL === LOCALHOST) {
    console.log('\n💡 To test Vercel deployment, run:');
    console.log('   node test-all-apis.mjs --vercel');
  }
}

runTests().catch(console.error);