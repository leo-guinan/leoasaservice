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
2. **Processing**: PDFs are uploaded to S3 and text is extracted
3. **Analysis**: The extracted text is analyzed using AI (same as URLs)
4. **Integration**: The PDF appears in the URL list with its S3 URL
5. **Chat**: Users can ask questions about the uploaded PDF content

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