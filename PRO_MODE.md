# ⚡ Pro Mode - Advanced Context Management

## 🎯 Overview

Pro Mode is an advanced feature that allows users to create and manage multiple research context profiles. This enables researchers to maintain separate, focused contexts for different projects, research areas, or collaborations.

## 🚀 Key Features

### **Multiple Context Profiles**
- Create unlimited context profiles for different research areas
- Each profile maintains its own versioned context history
- Switch between profiles seamlessly
- Profile-specific context updates and management

### **Manual Context Control**
- Trigger context updates manually when needed
- Force updates even without new activity
- Full control over when and how contexts are updated
- Date-specific context processing

### **Advanced Profile Management**
- Create, switch, and delete context profiles
- Profile descriptions and metadata
- Version tracking for each profile
- Active profile indication

### **Seamless Integration**
- Pro mode users automatically use profile-based contexts
- Regular users continue using the standard context system
- Chat agent automatically adapts to active profile
- No disruption to existing workflows

## 🔧 Technical Implementation

### **Database Schema**

#### **Users Table Enhancement**
```sql
ALTER TABLE users ADD COLUMN pro_mode BOOLEAN NOT NULL DEFAULT FALSE;
```

#### **Context Profiles Table**
```sql
CREATE TABLE user_context_profiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### **Profile Context Data Table**
```sql
CREATE TABLE user_context_profile_data (
  id SERIAL PRIMARY KEY,
  profile_id INTEGER NOT NULL,
  context JSONB NOT NULL,
  last_updated TIMESTAMP DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1
);
```

### **Backend Components**

#### **Context Profile Tool** (`server/mastra/tools/context-profile-tool.ts`)
- **Actions**: `list`, `create`, `switch`, `delete`, `update`
- **Features**: Profile CRUD operations, active profile management
- **Validation**: Pro mode requirement, unique profile names

#### **Manual Context Update Tool** (`server/mastra/tools/manual-context-update-tool.ts`)
- **Features**: Manual context updates, force updates, profile-specific processing
- **Integration**: Uses existing `userActivityTool` and `contextUpdateTool`
- **Validation**: Pro mode requirement, active profile check

#### **Enhanced Chat Agent** (`server/mastra/agents/chat-agent.ts`)
- **Adaptive Context**: Automatically uses profile context for pro users
- **Fallback**: Uses standard context for regular users
- **Seamless**: No changes needed in chat interface

### **API Endpoints**

#### **Profile Management**
```http
POST /api/pro/profiles
{
  "action": "create|list|switch|delete|update",
  "profileName": "string",
  "description": "string",
  "profileId": "number"
}
```

#### **Manual Context Update**
```http
POST /api/pro/context-update
{
  "date": "YYYY-MM-DD",
  "profileId": "number",
  "forceUpdate": "boolean"
}
```

#### **Pro Mode Status**
```http
GET /api/pro/status
```

### **Frontend Components**

#### **Pro Mode Panel** (`client/src/components/pro-mode-panel.tsx`)
- **Modal Interface**: Clean, intuitive profile management
- **Real-time Updates**: React Query integration for live data
- **Error Handling**: Comprehensive error states and user feedback
- **Responsive Design**: Works on all screen sizes

#### **Integration Points**
- **Workspace Header**: Pro Mode button for easy access
- **Conditional Rendering**: Only shows for pro mode users
- **State Management**: React Query for server state synchronization

## 🎮 Usage Guide

### **Enabling Pro Mode**

1. **Enable for a user**:
   ```bash
   npm run enable-pro-mode
   ```

2. **Verify activation**:
   - Check user table for `pro_mode = true`
   - Pro Mode button appears in workspace header

### **Creating Your First Profile**

1. **Click "Pro Mode"** in the workspace header
2. **Enter profile details**:
   - Name: "AI Research" (or your project name)
   - Description: "Research focused on artificial intelligence"
3. **Click "Create Profile"**
4. **Switch to the profile** using the checkmark button

### **Managing Multiple Profiles**

#### **Creating Additional Profiles**
- Use the "Create New Context Profile" section
- Each profile can have a different research focus
- Examples: "Blockchain Research", "Healthcare AI", "Academic Writing"

#### **Switching Between Profiles**
- Click the checkmark button next to any inactive profile
- The active profile is highlighted in blue
- Chat context automatically updates to the active profile

#### **Deleting Profiles**
- Click the trash icon next to inactive profiles
- Cannot delete the currently active profile
- All profile data is permanently removed

### **Manual Context Updates**

#### **Standard Update**
1. Select a date (defaults to today)
2. Click "Update Context"
3. System processes activity for that date
4. Context is updated if new activity is found

#### **Force Update**
1. Select a date
2. Click "Force Update"
3. Context is updated regardless of activity
4. Useful for refining existing contexts

### **Best Practices**

#### **Profile Organization**
- Use descriptive names: "PhD Research", "Industry Project", "Academic Writing"
- Add helpful descriptions for context
- Keep profiles focused on specific research areas

#### **Context Management**
- Update contexts after significant research sessions
- Use force updates to refine contexts based on new insights
- Switch profiles when changing research focus

#### **Workflow Integration**
- Create profiles for different research phases
- Use manual updates for precise control
- Leverage profile switching for multi-project research

## 🧪 Testing

### **Comprehensive Test Suite**
```bash
# Enable pro mode for testing
npm run enable-pro-mode

# Run full pro mode test
npm run test:pro-mode
```

### **Test Coverage**
- Profile creation and management
- Profile switching functionality
- Manual context updates
- Error handling and validation
- Integration with existing systems

### **Manual Testing Steps**
1. Start server: `npm run dev`
2. Login and verify Pro Mode button appears
3. Create multiple profiles
4. Switch between profiles
5. Test manual context updates
6. Verify chat uses correct profile context

## 🔒 Security & Validation

### **Pro Mode Requirements**
- Only users with `pro_mode = true` can access pro features
- All API endpoints validate pro mode status
- Graceful fallback for non-pro users

### **Profile Security**
- Users can only access their own profiles
- Profile isolation prevents cross-user access
- Secure profile deletion with confirmation

### **Data Integrity**
- Version tracking prevents context corruption
- Transactional operations ensure consistency
- Backup and recovery considerations

## 🚀 Future Enhancements

### **Planned Features**
- **Profile Templates**: Pre-configured research contexts
- **Profile Sharing**: Collaborative research contexts
- **Advanced Analytics**: Profile usage and effectiveness metrics
- **Bulk Operations**: Multi-profile context updates
- **Profile Export/Import**: Backup and restore functionality

### **Integration Opportunities**
- **Calendar Integration**: Automatic context updates based on scheduled research sessions
- **Git Integration**: Link profiles to specific repositories or branches
- **Collaboration Tools**: Shared profiles for team research
- **Advanced AI**: Profile-specific AI model fine-tuning

## 📊 Performance Considerations

### **Database Optimization**
- Indexed queries for profile lookups
- Efficient context versioning
- Optimized profile switching

### **Caching Strategy**
- Profile data caching for frequent switches
- Context data caching for improved performance
- React Query integration for client-side caching

### **Scalability**
- Support for unlimited profiles per user
- Efficient context storage and retrieval
- Minimal performance impact on regular users

## 🐛 Troubleshooting

### **Common Issues**

#### **Pro Mode Button Not Visible**
- Check user's `pro_mode` status in database
- Verify user is logged in
- Check browser console for errors

#### **Profile Creation Fails**
- Ensure profile name is unique for the user
- Check for required fields (name)
- Verify pro mode is enabled

#### **Context Updates Not Working**
- Check for active profile
- Verify date format (YYYY-MM-DD)
- Check server logs for errors

#### **Profile Switching Issues**
- Ensure target profile exists
- Check for database connection issues
- Verify user permissions

### **Debug Commands**
```bash
# Check pro mode status
npm run enable-pro-mode

# Test full functionality
npm run test:pro-mode

# Check database state
# (Use your preferred database client)
```

## 📚 API Reference

### **Context Profile Tool**
```typescript
interface ContextProfileTool {
  id: 'manage-context-profiles';
  inputSchema: {
    action: 'list' | 'create' | 'switch' | 'delete' | 'update';
    userId: number;
    profileName?: string;
    description?: string;
    profileId?: number;
  };
  outputSchema: {
    success: boolean;
    message: string;
    profiles?: ContextProfile[];
    activeProfile?: ActiveProfile;
  };
}
```

### **Manual Context Update Tool**
```typescript
interface ManualContextUpdateTool {
  id: 'manual-context-update';
  inputSchema: {
    userId: number;
    date?: string;
    profileId?: number;
    forceUpdate?: boolean;
  };
  outputSchema: {
    success: boolean;
    message: string;
    profileName?: string;
    activityFound: boolean;
    contextUpdated: boolean;
    summary?: string;
  };
}
```

---

**Pro Mode** transforms ResearchBuddy from a single-context research assistant into a powerful multi-project research management system, giving advanced users the control and flexibility they need for complex research workflows. 