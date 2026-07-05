const fs = require('fs');

let code = fs.readFileSync('pages/Transactions.tsx', 'utf8');

const funcToInject = `
  const openCamera = async () => {
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera
      });

      if (image.dataUrl) {
        setIsUploading(true);
        try {
          const data = await analyzeReceipt(image.dataUrl);
          if (data) {
            const type = (data.type?.toLowerCase() === 'income' ? 'income' : 'expense') as TransactionType;
            const cat = data.category.trim().charAt(0).toUpperCase() + data.category.trim().slice(1);

            setFormData({
              amount: data.amount.toString(),
              category: cat,
              type: type,
              description: data.description,
              date: data.date,
              excludeFromAnalytics: type === 'income' && (cat.toLowerCase().includes('loan') || cat.toLowerCase().includes('repayment'))
            });
            setShowAdd(true);
          } else {
            alert('Could not extract data from receipt. Please try again or enter manually.');
            setShowAdd(true);
          }
        } catch (error) {
          console.error('Error parsing receipt:', error);
          alert('Error reading receipt data. Try again.');
        } finally {
          setIsUploading(false);
        }
      }
    } catch (err) {
      console.error('Camera closed or error:', err);
    }
  };
`;

code = code.replace(/setShowAdd\(true\);\n  };\n\n/, 'setShowAdd(true);\n  };\n\n' + funcToInject + '\n');

fs.writeFileSync('pages/Transactions.tsx', code);
console.log("Fixed!");