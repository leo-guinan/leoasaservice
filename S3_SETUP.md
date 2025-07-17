# S3 Setup for PDF Uploads

This application now supports PDF file uploads to AWS S3. When a PDF is uploaded, it's automatically processed and integrated into the URL analysis flow.

## Required Environment Variables

Add these to your `.env` file:

```env
# AWS S3 Configuration
AWS_ACCESS_KEY_ID=your-aws-access-key-id
AWS_SECRET_ACCESS_KEY=your-aws-secret-access-key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-s3-bucket-name
```

## AWS Setup

1. **Create an S3 Bucket**:
   - Go to AWS S3 Console
   - Create a new bucket with a unique name
   - Set the bucket name in `AWS_S3_BUCKET`

2. **Create IAM User**:
   - Go to AWS IAM Console
   - Create a new user for the application
   - Attach the `AmazonS3FullAccess` policy (or create a custom policy with minimal permissions)
   - Generate access keys and add them to your environment variables

3. **Bucket Permissions**:
   - Ensure your bucket allows uploads from your application
   - Consider setting up CORS if needed for direct browser uploads

## How It Works

1. **Upload**: Users can upload PDF files using the file icon button in the chat
2. **Processing**: PDFs are uploaded to S3 and stored with metadata
3. **Text Extraction**: Currently uses a placeholder. For production, consider:
   - AWS Textract for OCR and text extraction
   - Google Cloud Vision API
   - Azure Computer Vision
   - Or integrate with a different PDF parsing service
4. **Analysis**: The extracted text is analyzed using AI (same as URLs)
5. **Integration**: The PDF appears in the URL list with its S3 URL
6. **Chat**: Users can ask questions about the uploaded PDF content

## Text Extraction Options

For production use, consider these alternatives to extract text from PDFs:

### AWS Textract (Recommended)
```javascript
import { TextractClient, DetectDocumentTextCommand } from "@aws-sdk/client-textract";

const textract = new TextractClient({ region: "us-east-1" });
const command = new DetectDocumentTextCommand({
  Document: { Bytes: pdfBuffer }
});
const result = await textract.send(command);
const text = result.Blocks?.map(block => block.Text).join(" ") || "";
```

### Google Cloud Vision API
```javascript
import vision from '@google-cloud/vision';
const client = new vision.ImageAnnotatorClient();
// Implementation for PDF text extraction
```

### Azure Computer Vision
```javascript
import { ComputerVisionClient } from '@azure/cognitiveservices-computervision';
// Implementation for PDF text extraction
```

## File Limits

- Maximum file size: 10MB
- Supported format: PDF only
- Files are stored in S3 with unique keys: `uploads/{userId}/{fileId}.pdf`

## Security

- Files are stored per user in separate folders
- Access is controlled by authentication
- S3 URLs are generated with temporary presigned URLs
- File metadata includes user information for tracking

## Troubleshooting

If PDF uploads fail:
1. Check that all S3 environment variables are set
2. Verify AWS credentials have proper permissions
3. Ensure the S3 bucket exists and is accessible
4. Check server logs for detailed error messages 