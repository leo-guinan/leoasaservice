# Daily Context Summary Feature

The daily context summary feature provides users with a comprehensive overview of changes made to their research context, allowing them to review updates and provide feedback.

## 🎯 Overview

Each day, users see a concise summary of their research context changes at the top of the chat interface. This includes:

- **Meaningful Change Detection**: Specific additions, removals, and updates to research areas
- **Clear Language**: Human-readable descriptions of what changed
- **Markdown Formatting**: Rich, readable presentation of changes
- **Automatic Integration**: User feedback through chat messages is incorporated into future updates

## 🚀 Features

### **Context Comparison**
- Shows the most recent two versions of user context
- Displays changes in research interests, projects, knowledge areas, insights, and patterns
- Highlights specific additions, removals, and modifications

### **Change Detection**
- **Added/Removed Research Interests**: Shows new focus areas or completed topics
- **Started/Completed Projects**: Tracks active research initiatives
- **Expanded Knowledge Areas**: Shows new areas of expertise
- **New Insights**: Captures key understandings and discoveries
- **New Research Patterns**: Identifies evolving research behaviors

### **User Interface**
- **Dismissible Banner**: Users can close the summary
- **Refresh Capability**: Reload the summary if needed
- **Visual Indicators**: Color-coded sections for easy scanning
- **Clean Design**: Focused on the essential information

### **Responsive Design**
- Works on desktop and mobile devices
- Adaptive layout for different screen sizes
- Touch-friendly interface elements

## 📊 How It Works

### **1. Context Generation**
- The system runs daily context updates via the `userContextWorkflow`
- Each update creates a new version of the user's context
- Context is based on user activity (messages, URLs, questions)

### **2. Summary Creation**
- The `contextSummaryTool` compares the two most recent context versions
- Identifies specific changes in each category
- Generates a human-readable summary with markdown formatting

### **3. Display**
- The `DailyContextSummary` component shows the summary in the chat interface
- Appears at the top of the chat when users first open it
- Can be dismissed or refreshed as needed

### **4. User Feedback**
- Users can provide feedback through normal chat messages
- Any corrections or clarifications are automatically incorporated into future context updates
- No separate feedback mechanism needed - natural conversation flow

## 🔧 Technical Implementation

### **Backend Components**

#### **Context Summary Tool** (`server/mastra/tools/context-summary-tool.ts`)
```typescript
export const contextSummaryTool = createTool({
  id: 'get-context-summary',
  description: 'Get a summary of user context changes for a specific date',
  inputSchema: z.object({
    userId: z.number(),
    date: z.string(),
  }),
  outputSchema: z.object({
    userId: z.number(),
    date: z.string(),
    hasPreviousContext: z.boolean(),
    hasCurrentContext: z.boolean(),
    previousContext: z.any().optional(),
    currentContext: z.any().optional(),
    summary: z.string(),
    changes: z.array(z.string()),
  }),
  // ... implementation
});
```

#### **API Endpoint** (`server/routes.ts`)
```typescript
app.get("/api/user/context-summary/:date", authenticateToken, async (req: AuthRequest, res) => {
  // Fetches and returns context summary for the specified date
});
```

### **Frontend Components**

#### **Daily Context Summary Component** (`client/src/components/daily-context-summary.tsx`)
- React component with TypeScript
- Uses React Query for data fetching
- Integrates with the Markdown component for rich formatting
- Handles loading states, errors, and user interactions

#### **Integration with Chat** (`client/src/components/ai-chat.tsx`)
- Displays the summary at the top of the chat interface
- Manages visibility state (show/hide)
- Provides dismiss functionality

## 📝 Example Output

### **Summary Display**
```
📅 Daily Context Summary - 7/21/2025

**Research Context Updated**

Based on your recent activity, I've updated your research profile:

✅ **Added research interests**: blockchain applications in healthcare, zero-knowledge proofs
✅ **Started new projects**: implementing blockchain for patient data privacy
✅ **Expanded knowledge in**: privacy techniques for medical data
✅ **New insights**: Machine learning is crucial for healthcare advancements; Zero-knowledge proofs offer advanced privacy for medical data
✅ **New research patterns**: emerging interest in privacy-enhancing technologies
```

## 🧪 Testing

### **Test Scripts**
```bash
# Test the daily context summary feature
npm run test:daily-summary

# Test the context-aware chat system
npm run test:context-chat

# Check context dates in database
npx tsx scripts/check-contexts.ts
```

### **Manual Testing**
1. Start the server: `npm run dev`
2. Open the chat interface
3. Look for the daily context summary banner
4. Test dismiss and refresh functionality
5. Try the feedback buttons

## 🎨 Customization

### **Styling**
- CSS classes in `client/src/index.css`
- Tailwind CSS for responsive design
- Custom color scheme matching the app theme

### **Content**
- Modify the summary text in `contextSummaryTool`
- Adjust change detection logic
- Customize the comparison display

### **Behavior**
- Change when the summary appears
- Modify the feedback options
- Adjust the refresh behavior

## 🔮 Future Enhancements

### **Planned Features**
- **Historical View**: Browse context changes over time
- **Detailed Diff**: Show exact text changes
- **User Annotations**: Allow users to add notes to changes
- **Automated Corrections**: Learn from user feedback

### **Potential Improvements**
- **Email Summaries**: Send daily summaries via email
- **Weekly Reports**: Aggregate weekly context changes
- **Trend Analysis**: Identify long-term research patterns
- **Collaboration**: Share context summaries with research partners

## 📚 Related Documentation

- [Markdown Features](./MARKDOWN_FEATURES.md) - Rich text formatting
- [Context-Aware Chat](./README.md) - AI chat with context integration
- [User Context Workflow](./README.md) - Automated context updates

## 🛠️ Troubleshooting

### **Common Issues**

**Summary not appearing:**
- Check if context updates have been run
- Verify the user has activity data
- Ensure the API endpoint is accessible

**No changes detected:**
- Context might be identical between versions
- Check the change detection logic
- Verify context data structure

**Performance issues:**
- Limit the number of contexts compared
- Optimize database queries
- Consider caching for frequent requests

### **Debug Commands**
```bash
# Check context versions
npx tsx scripts/check-contexts.ts

# Test context summary tool directly
npx tsx scripts/test-daily-summary.ts

# Verify API endpoint
curl -H "Authorization: Bearer <token>" http://localhost:5000/api/user/context-summary/2025-07-21
``` 