// Simple JWT decoder to extract user ID from Clerk token
const decodeClerkToken = (token) => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    // Clerk uses 'sub' field for user ID
    return payload.sub || payload.user_id || payload.id;
  } catch (error) {
    console.error('JWT decode error:', error);
    return null;
  }
};

const requireAuth = (req, res, next) => {
  console.log('🔐 Auth check for:', req.path);
  console.log('📋 Auth header:', req.headers.authorization ? 'Present' : 'Missing');
  
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    
    // Decode the JWT to get the actual Clerk user ID
    const clerkUserId = decodeClerkToken(token);
    
    if (clerkUserId) {
      console.log('✅ Decoded Clerk user ID:', clerkUserId);
      req.auth = { 
        userId: clerkUserId,  // Use the actual Clerk user ID
        token: token         // Keep the original token for reference
      };
    } else {
      console.log('⚠️ Could not decode JWT, using token as userId');
      req.auth = { 
        userId: token,       // Fallback to using token as ID
        token: token
      };
    }
    
    console.log('✅ Auth OK, will store userId as:', req.auth.userId);
    next();
  } else {
    console.log('❌ No auth token');
    res.status(401).json({ error: 'Authentication required' });
  }
};

module.exports = { requireAuth };
