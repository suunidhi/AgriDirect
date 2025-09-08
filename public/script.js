const productData = {
    fruits: ['Apples', 'Bananas', 'Mangoes', 'Oranges'],
    vegetables: ['Tomatoes', 'Carrots', 'Spinach', 'Onions'],
    crops: ['Wheat', 'Rice', 'Barley', 'Corn']
  };
  
  const productsDiv = document.getElementById('products');
  
  document.querySelectorAll('.category-button').forEach(button => {
    button.addEventListener('click', () => {
      const category = button.classList.contains('fruits') ? 'fruits' :
                       button.classList.contains('vegetables') ? 'vegetables' :
                       'crops';
  
      const items = productData[category];
      
      // Clear previous products
      productsDiv.innerHTML = `<h3>${capitalize(category)} Available</h3><ul>${items.map(item => `<li>${item}</li>`).join('')}</ul>`;
    });
  });
  
  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
  