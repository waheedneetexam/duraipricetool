const fs = require('fs');

async function testUpload() {
  const tableId = 'products';
  // Create dummy CSV
  const csvContent = "SKU,Product_Name,Price,Is_Active,Category\nSW-123,Test Software,100,true,software\n";
  fs.writeFileSync('test.csv', csvContent);

  const fileBlob = new Blob([fs.readFileSync('test.csv')], { type: 'text/csv' });
  const formData = new FormData();
  formData.append('file', fileBlob, 'test.csv');
  
  const mapping = {
    "sku": "SKU",
    "name": "Product_Name",
    "price": "Price",
    "active": "Is_Active",
    "category": "Category"
  };
  
  formData.append('mapping_json', JSON.stringify(mapping));
  formData.append('update_duplicates', 'true');
  
  try {
    const res = await fetch(`http://localhost:8000/api/v1/admin/tables/${tableId}/upload-csv`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer test_token' // test_token gives access in dev mode
      },
      body: formData
    });
    
    console.log("Status:", res.status);
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
  } catch(e) {
    console.error(e);
  }
}

testUpload();
