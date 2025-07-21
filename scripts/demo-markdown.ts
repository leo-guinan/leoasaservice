#!/usr/bin/env tsx

console.log('🎨 Markdown Chat Demo');
console.log('='.repeat(50));

const sampleResponses = [
  {
    role: 'assistant',
    content: `## Healthcare AI Implementation Guide

Based on your research context, here's how to implement **healthcare AI techniques**:

### 1. **Data Preparation**
• Ensure your medical imaging data is properly labeled
• Use \`DICOM\` format for medical images
• Implement data augmentation techniques

### 2. **Model Selection**
> **Recommendation**: Start with pre-trained models like ResNet or EfficientNet for medical imaging tasks.

### 3. **Implementation Steps**
1. **Data Preprocessing**
   - Normalize pixel values
   - Apply medical-specific augmentations
   - Split data into train/validation/test sets

2. **Model Training**
   - Use transfer learning from ImageNet weights
   - Implement early stopping
   - Monitor for overfitting

3. **Evaluation**
   - Use medical-specific metrics (AUC, sensitivity, specificity)
   - Validate on external datasets

### 4. **Ethical Considerations**
Since you're interested in ethical AI, remember to:
• Ensure patient privacy compliance (HIPAA)
• Address algorithmic bias
• Maintain transparency in decision-making

### 5. **Next Steps**
Based on your research patterns, consider exploring:
• **Federated Learning** for privacy-preserving AI
• **Explainable AI** techniques for medical applications
• Integration with existing **radiology workflows**

Would you like me to elaborate on any of these aspects?`
  },
  {
    role: 'assistant', 
    content: `## Research Context Integration

I notice from your research context that you're working on **"The Trust Engine Vision Statement"** and exploring **memetic theory**. This connects interestingly to healthcare AI!

### Trust Mechanisms in Healthcare AI
Your work on trust mechanisms is particularly relevant here. Healthcare AI systems need:
• **Transparency** in decision-making
• **Reliability** in predictions
• **Accountability** for outcomes

### Memetic Theory Connection
The spread of AI adoption in healthcare follows memetic patterns:
• **Viral adoption** of successful AI tools
• **Cultural resistance** to new technologies
• **Value evolution** in medical practice

### Network Theory Application
Your personal theory of network relativity could help model:
• **Information flow** in healthcare systems
• **Trust propagation** between medical professionals
• **AI adoption networks** in hospitals

This creates a fascinating intersection between your philosophical interests and practical AI implementation!`
  }
];

console.log('📝 Sample AI Responses with Markdown:');
console.log('');

sampleResponses.forEach((response, index) => {
  console.log(`Response ${index + 1}:`);
  console.log('-'.repeat(40));
  console.log(response.content);
  console.log('');
  console.log('Rendered as:');
  console.log('• Headings (##, ###) for structure');
  console.log('• **Bold text** for emphasis');
  console.log('• Bullet points (•) for lists');
  console.log('• Numbered lists (1., 2., 3.)');
  console.log('• `Code snippets` for technical terms');
  console.log('• > Blockquotes for important notes');
  console.log('• Context-aware content based on user research');
  console.log('');
});

console.log('✅ The chat interface will now render these responses with:');
console.log('• Proper heading hierarchy');
console.log('• Styled bullet points and lists');
console.log('• Highlighted code blocks');
console.log('• Clickable links');
console.log('• Responsive tables');
console.log('• Context-aware formatting');

console.log('');
console.log('🚀 Start your server with "npm run dev" to see it in action!'); 