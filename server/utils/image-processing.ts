// Image processing utilities with optional sharp support

let sharp: any = null;
let sharpLoaded = false;

/**
 * Safely load the sharp module
 */
export async function loadSharp(): Promise<any> {
  if (sharpLoaded) {
    return sharp;
  }

  try {
    // Dynamic import to avoid loading issues at startup
    const sharpModule = await import('sharp');
    sharp = sharpModule.default;
    sharpLoaded = true;
    console.log('✅ Sharp module loaded successfully');
    return sharp;
  } catch (error) {
    console.warn('⚠️ Sharp module not available for image optimization:', error instanceof Error ? error.message : 'Unknown error');
    sharpLoaded = true; // Mark as loaded to avoid repeated attempts
    return null;
  }
}

/**
 * Optimize an image buffer using sharp if available
 */
export async function optimizeImage(buffer: Buffer, options: {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'png' | 'jpeg' | 'webp';
} = {}): Promise<Buffer> {
  const {
    width = 1200,
    height = 1600,
    quality = 90,
    format = 'png'
  } = options;

  try {
    const sharpInstance = await loadSharp();
    
    if (!sharpInstance) {
      console.log('ℹ️ Using original image (sharp not available)');
      return buffer;
    }

    let sharpChain = sharpInstance(buffer);

    // Resize if dimensions provided
    if (width && height) {
      sharpChain = sharpChain.resize(width, height, { 
        fit: 'inside', 
        withoutEnlargement: true 
      });
    }

    // Apply format-specific options
    switch (format) {
      case 'png':
        sharpChain = sharpChain.png({ quality });
        break;
      case 'jpeg':
        sharpChain = sharpChain.jpeg({ quality });
        break;
      case 'webp':
        sharpChain = sharpChain.webp({ quality });
        break;
      default:
        sharpChain = sharpChain.png({ quality });
    }

    const optimizedBuffer = await sharpChain.toBuffer();
    console.log(`✅ Image optimized: ${buffer.length} -> ${optimizedBuffer.length} bytes`);
    return optimizedBuffer;

  } catch (error) {
    console.warn('⚠️ Image optimization failed, using original:', error instanceof Error ? error.message : 'Unknown error');
    return buffer;
  }
}

/**
 * Check if sharp is available
 */
export function isSharpAvailable(): boolean {
  return sharp !== null;
}

/**
 * Get image metadata if sharp is available
 */
export async function getImageMetadata(buffer: Buffer): Promise<any> {
  try {
    const sharpInstance = await loadSharp();
    
    if (!sharpInstance) {
      return null;
    }

    const metadata = await sharpInstance(buffer).metadata();
    return metadata;
  } catch (error) {
    console.warn('⚠️ Failed to get image metadata:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
} 