import { createTool } from "@mastra/core";
import { z } from "zod";
import { storage } from "../../storage";
import { nanoid } from "nanoid";

// GitHub API types
interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string;
  html_url: string;
  clone_url: string;
  language: string;
  size: number;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  updated_at: string;
  created_at: string;
  license?: {
    name: string;
    spdx_id: string;
  };
  default_branch: string;
  topics: string[];
  archived: boolean;
  disabled: boolean;
}

interface GitHubContent {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  html_url: string;
  git_url: string;
  download_url: string | null;
  type: "file" | "dir";
  content?: string;
  encoding?: string;
}

interface GitHubCommit {
  sha: string;
  commit: {
    message: string;
    author: {
      name: string;
      email: string;
      date: string;
    };
  };
  author?: {
    login: string;
  };
}

// Analysis result types
interface RepoMetadata {
  url: string;
  name: string;
  description: string;
  language: string;
  size: number;
  stars: number;
  forks: number;
  issues: number;
  lastUpdated: string;
  license?: string;
  topics: string[];
  isArchived: boolean;
  defaultBranch: string;
}

interface TechStack {
  primaryLanguage: string;
  buildFiles: string[];
  frameworks: string[];
  packageManagers: string[];
  databases: string[];
  deploymentTools: string[];
}

interface FileAnalysis {
  path: string;
  purpose: string;
  dependencies: string[];
  exports: string[];
  complexityScore: number;
  lastModified: string;
  primaryAuthor: string;
  size: number;
  language: string;
}

interface ModuleAnalysis {
  name: string;
  path: string;
  type: 'module' | 'package' | 'service' | 'component';
  files: FileAnalysis[];
  dependencies: string[];
  exports: string[];
  purpose: string;
  complexityScore: number;
  entryPoints: string[];
  boundaries: {
    imports: string[];
    exports: string[];
    internalDependencies: string[];
  };
}

interface EntryPoint {
  path: string;
  type: 'main' | 'cli' | 'web' | 'test' | 'config';
  purpose: string;
  dependencies: string[];
  isPublic: boolean;
}

interface ArchitecturePattern {
  type: 'monolith' | 'microservices' | 'modular' | 'layered' | 'event-driven';
  confidence: number;
  indicators: string[];
  modules: ModuleAnalysis[];
  entryPoints: EntryPoint[];
  dataFlow: {
    inputs: string[];
    outputs: string[];
    transformations: string[];
  };
}

interface QualityMetrics {
  testCoverage: {
    unitTests: number;
    integrationTests: number;
    e2eTests: number;
  };
  codeQuality: {
    complexityHotspots: number;
    duplicationScore: number;
    documentationCoverage: number;
  };
  maintenance: {
    lastCommitAge: number;
    contributorCount: number;
    issueResponseTime: number;
  };
}

interface BoundedContext {
  id: string;
  name: string;
  type: "metadata" | "architecture" | "module" | "file" | "quality" | "risk";
  description: string;
  data: any;
  relationships: string[];
  lastUpdated: string;
  cost: number;
}

interface GitHubAnalysisResult {
  repository: RepoMetadata;
  techStack: TechStack;
  architecture: ArchitecturePattern;
  contexts: BoundedContext[];
  insights: {
    risks: string[];
    improvements: string[];
    opportunities: string[];
  };
  metrics: {
    totalContexts: number;
    analysisDuration: number;
    estimatedCost: number;
  };
}

// GitHub API helper functions
async function getGitHubToken(): Promise<string> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GitHub token not found in environment variables");
  }
  return token;
}

async function fetchGitHubRepo(owner: string, repo: string): Promise<GitHubRepo> {
  const token = await getGitHubToken();
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'ResearchBuddy-GitHub-Analyzer'
    }
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function fetchRepoContents(owner: string, repo: string, path: string = ""): Promise<GitHubContent[]> {
  const token = await getGitHubToken();
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'ResearchBuddy-GitHub-Analyzer'
    }
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function fetchFileContent(owner: string, repo: string, path: string): Promise<string> {
  const token = await getGitHubToken();
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3.raw',
      'User-Agent': 'ResearchBuddy-GitHub-Analyzer'
    }
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

// Analysis functions
function extractRepoMetadata(repo: GitHubRepo): RepoMetadata {
  return {
    url: repo.html_url,
    name: repo.full_name,
    description: repo.description || "",
    language: repo.language || "Unknown",
    size: repo.size,
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    issues: repo.open_issues_count,
    lastUpdated: repo.updated_at,
    license: repo.license?.name,
    topics: repo.topics,
    isArchived: repo.archived,
    defaultBranch: repo.default_branch
  };
}

function detectTechStack(contents: GitHubContent[]): TechStack {
  const buildFiles = contents
    .filter(item => item.type === "file")
    .map(item => item.name)
    .filter(name => [
      'package.json', 'requirements.txt', 'Pipfile', 'pyproject.toml',
      'pom.xml', 'build.gradle', 'Cargo.toml', 'go.mod', 'composer.json',
      'Gemfile', 'Makefile', 'Dockerfile', 'docker-compose.yml',
      'webpack.config.js', 'vite.config.js', 'next.config.js',
      'tailwind.config.js', 'tsconfig.json', '.eslintrc.js'
    ].includes(name));

  const frameworks: string[] = [];
  const packageManagers: string[] = [];
  const databases: string[] = [];
  const deploymentTools: string[] = [];

  // Detect frameworks and tools based on build files
  if (buildFiles.includes('package.json')) {
    packageManagers.push('npm/yarn');
  }
  if (buildFiles.includes('requirements.txt') || buildFiles.includes('Pipfile')) {
    packageManagers.push('pip');
  }
  if (buildFiles.includes('pom.xml') || buildFiles.includes('build.gradle')) {
    packageManagers.push('maven/gradle');
  }
  if (buildFiles.includes('Cargo.toml')) {
    packageManagers.push('cargo');
  }
  if (buildFiles.includes('go.mod')) {
    packageManagers.push('go modules');
  }
  if (buildFiles.includes('Dockerfile')) {
    deploymentTools.push('Docker');
  }
  if (buildFiles.includes('docker-compose.yml')) {
    deploymentTools.push('Docker Compose');
  }
  if (buildFiles.includes('next.config.js')) {
    frameworks.push('Next.js');
  }
  if (buildFiles.includes('tailwind.config.js')) {
    frameworks.push('Tailwind CSS');
  }

  return {
    primaryLanguage: "Unknown", // Will be updated from repo metadata
    buildFiles,
    frameworks,
    packageManagers,
    databases,
    deploymentTools
  };
}

async function analyzeFileStructure(owner: string, repo: string, contents: GitHubContent[]): Promise<FileAnalysis[]> {
  const fileAnalyses: FileAnalysis[] = [];

  for (const item of contents) {
    if (item.type === "file" && item.size < 100000) { // Skip large files
      try {
        const content = await fetchFileContent(owner, repo, item.path);
        
        // Simple analysis based on file extension and content
        const language = getLanguageFromExtension(item.name);
        const purpose = inferFilePurpose(item.name, item.path, content);
        const dependencies = extractDependencies(content, language);
        const complexityScore = calculateComplexity(content, language);

        fileAnalyses.push({
          path: item.path,
          purpose,
          dependencies,
          exports: [], // Would need AST parsing for accurate exports
          complexityScore,
          lastModified: new Date().toISOString(), // Would need git history
          primaryAuthor: "Unknown", // Would need git blame
          size: item.size,
          language
        });
      } catch (error) {
        console.warn(`Failed to analyze file ${item.path}:`, error);
      }
    }
  }

  return fileAnalyses;
}

function getLanguageFromExtension(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const languageMap: Record<string, string> = {
    'js': 'JavaScript',
    'ts': 'TypeScript',
    'py': 'Python',
    'java': 'Java',
    'go': 'Go',
    'rs': 'Rust',
    'php': 'PHP',
    'rb': 'Ruby',
    'cs': 'C#',
    'cpp': 'C++',
    'c': 'C',
    'html': 'HTML',
    'css': 'CSS',
    'scss': 'SCSS',
    'json': 'JSON',
    'yaml': 'YAML',
    'yml': 'YAML',
    'md': 'Markdown',
    'sql': 'SQL'
  };
  return languageMap[ext || ''] || 'Unknown';
}

function inferFilePurpose(filename: string, path: string, content: string): string {
  const lowerContent = content.toLowerCase();
  
  if (filename === 'README.md') return 'Project documentation and setup instructions';
  if (filename === 'package.json') return 'Node.js project configuration and dependencies';
  if (filename === 'requirements.txt') return 'Python dependencies list';
  if (filename === 'Dockerfile') return 'Docker container configuration';
  if (filename.includes('test') || filename.includes('spec')) return 'Test file';
  if (path.includes('/src/')) return 'Source code file';
  if (path.includes('/lib/')) return 'Library code file';
  if (path.includes('/config/')) return 'Configuration file';
  if (path.includes('/docs/')) return 'Documentation file';
  
  return 'Source code file';
}

function extractDependencies(content: string, language: string): string[] {
  const dependencies: string[] = [];
  
  if (language === 'JavaScript' || language === 'TypeScript') {
    const importMatches = content.match(/import\s+.*\s+from\s+['"]([^'"]+)['"]/g);
    const requireMatches = content.match(/require\s*\(\s*['"]([^'"]+)['"]\s*\)/g);
    
    if (importMatches) {
      importMatches.forEach(match => {
        const dep = match.match(/['"]([^'"]+)['"]/)?.[1];
        if (dep && !dep.startsWith('.')) dependencies.push(dep);
      });
    }
    
    if (requireMatches) {
      requireMatches.forEach(match => {
        const dep = match.match(/['"]([^'"]+)['"]/)?.[1];
        if (dep && !dep.startsWith('.')) dependencies.push(dep);
      });
    }
  } else if (language === 'Python') {
    const importMatches = content.match(/import\s+([a-zA-Z_][a-zA-Z0-9_]*)/g);
    const fromMatches = content.match(/from\s+([a-zA-Z_][a-zA-Z0-9_.]*)\s+import/g);
    
    if (importMatches) {
      importMatches.forEach(match => {
        const dep = match.replace('import ', '');
        if (dep && !dep.startsWith('.')) dependencies.push(dep);
      });
    }
    
    if (fromMatches) {
      fromMatches.forEach(match => {
        const dep = match.replace('from ', '').replace(' import', '');
        if (dep && !dep.startsWith('.')) dependencies.push(dep);
      });
    }
  }
  
  return Array.from(new Set(dependencies)); // Remove duplicates
}

function calculateComplexity(content: string, language: string): number {
  // Simple complexity calculation based on lines and control structures
  const lines = content.split('\n').length;
  const controlStructures = (content.match(/\b(if|for|while|switch|case|catch)\b/g) || []).length;
  const functions = (content.match(/\b(function|def|class)\b/g) || []).length;
  
  return Math.min(10, Math.floor((lines / 100) + (controlStructures / 10) + (functions / 5)));
}

function createBoundedContexts(
  metadata: RepoMetadata,
  techStack: TechStack,
  fileAnalyses: FileAnalysis[]
): BoundedContext[] {
  const contexts: BoundedContext[] = [];
  const now = new Date().toISOString();

  // Metadata context
  contexts.push({
    id: nanoid(),
    name: 'repo-metadata',
    type: 'metadata',
    description: 'Repository metadata and basic information',
    data: metadata,
    relationships: [],
    lastUpdated: now,
    cost: 0.1
  });

  // Tech stack context
  contexts.push({
    id: nanoid(),
    name: 'tech-stack',
    type: 'architecture',
    description: 'Technology stack and build configuration',
    data: techStack,
    relationships: ['repo-metadata'],
    lastUpdated: now,
    cost: 0.2
  });

  // File-level contexts
  fileAnalyses.forEach(file => {
    contexts.push({
      id: nanoid(),
      name: `file-${file.path.replace(/[^a-zA-Z0-9]/g, '-')}`,
      type: 'file',
      description: `Analysis of file: ${file.path}`,
      data: file,
      relationships: ['repo-metadata'],
      lastUpdated: now,
      cost: 0.05
    });
  });

  return contexts;
}

function generateInsights(
  metadata: RepoMetadata,
  techStack: TechStack,
  fileAnalyses: FileAnalysis[]
): { risks: string[]; improvements: string[]; opportunities: string[] } {
  const risks: string[] = [];
  const improvements: string[] = [];
  const opportunities: string[] = [];

  // Risk analysis
  if (metadata.isArchived) {
    risks.push('Repository is archived - may not receive updates');
  }
  if (metadata.issues > 100) {
    risks.push('High number of open issues may indicate maintenance challenges');
  }
  if (fileAnalyses.some(f => f.complexityScore > 8)) {
    risks.push('High complexity files detected - potential technical debt');
  }

  // Improvement suggestions
  if (!techStack.buildFiles.includes('README.md')) {
    improvements.push('Add README.md for better project documentation');
  }
  if (!techStack.buildFiles.includes('Dockerfile')) {
    improvements.push('Consider containerization for easier deployment');
  }
  if (fileAnalyses.length > 100) {
    improvements.push('Large codebase - consider modularization');
  }

  // Opportunities
  if (techStack.frameworks.includes('Next.js')) {
    opportunities.push('Next.js detected - potential for Vercel deployment');
  }
  if (techStack.packageManagers.includes('npm/yarn')) {
    opportunities.push('Node.js project - consider adding TypeScript for type safety');
  }

  return { risks, improvements, opportunities };
}

async function analyzeDirectoryRecursively(
  owner: string,
  repo: string,
  path: string = "",
  depth: number = 0,
  maxDepth: number = 3
): Promise<ModuleAnalysis[]> {
  const modules: ModuleAnalysis[] = [];
  
  try {
    console.log(`📁 Analyzing directory: ${path} (depth: ${depth})`);
    const contents = await fetchRepoContents(owner, repo, path);
    
    // Group files by potential modules
    const moduleGroups = groupFilesByModule(contents, path);
    
    for (const [moduleName, files] of Object.entries(moduleGroups)) {
      if (depth >= maxDepth) {
        console.log(`⏭️ Skipping deep directory: ${path}/${moduleName} (max depth reached)`);
        continue;
      }
      
      const modulePath = path ? `${path}/${moduleName}` : moduleName;
      const moduleAnalysis = await analyzeModule(owner, repo, modulePath, files, depth);
      modules.push(moduleAnalysis);
      
      // Recursively analyze subdirectories
      const subdirs = files.filter(item => item.type === 'dir');
      for (const subdir of subdirs) {
        const subModules = await analyzeDirectoryRecursively(
          owner, repo, `${modulePath}/${subdir.name}`, depth + 1, maxDepth
        );
        modules.push(...subModules);
      }
    }
    
  } catch (error) {
    console.warn(`Failed to analyze directory ${path}:`, error);
  }
  
  return modules;
}

function groupFilesByModule(contents: GitHubContent[], basePath: string): Record<string, GitHubContent[]> {
  const groups: Record<string, GitHubContent[]> = {};
  
  // Common module patterns
  const modulePatterns = [
    /^src\//,
    /^lib\//,
    /^app\//,
    /^components\//,
    /^services\//,
    /^utils\//,
    /^models\//,
    /^controllers\//,
    /^middleware\//,
    /^config\//,
    /^tests?\//,
    /^docs?\//,
  ];
  
  for (const item of contents) {
    let moduleName = 'root';
    
    // Determine module based on path patterns
    for (const pattern of modulePatterns) {
      if (pattern.test(item.path)) {
        const match = item.path.match(pattern);
        if (match) {
          moduleName = match[0].replace(/\/$/, '');
          break;
        }
      }
    }
    
    // Language-specific module detection
    if (item.name === 'package.json' || item.name === 'requirements.txt' || item.name === 'Cargo.toml') {
      moduleName = 'dependencies';
    } else if (item.name.includes('test') || item.name.includes('spec')) {
      moduleName = 'tests';
    } else if (item.name === 'README.md' || item.name === 'docs') {
      moduleName = 'documentation';
    }
    
    if (!groups[moduleName]) {
      groups[moduleName] = [];
    }
    groups[moduleName].push(item);
  }
  
  return groups;
}

async function analyzeModule(
  owner: string,
  repo: string,
  modulePath: string,
  files: GitHubContent[],
  depth: number
): Promise<ModuleAnalysis> {
  console.log(`🔍 Analyzing module: ${modulePath}`);
  
  const fileAnalyses: FileAnalysis[] = [];
  const dependencies: string[] = [];
  const exports: string[] = [];
  const entryPoints: string[] = [];
  
  // Analyze each file in the module
  for (const file of files) {
    if (file.type === 'file' && file.size < 100000) {
      try {
        const content = await fetchFileContent(owner, repo, file.path);
        const analysis = await analyzeFile(file.path, content);
        fileAnalyses.push(analysis);
        
        // Collect dependencies and exports
        dependencies.push(...analysis.dependencies);
        exports.push(...analysis.exports);
        
        // Identify entry points
        if (isEntryPoint(file.name, file.path, content)) {
          entryPoints.push(file.path);
        }
      } catch (error) {
        console.warn(`Failed to analyze file ${file.path}:`, error);
      }
    }
  }
  
  // Determine module type
  const moduleType = determineModuleType(modulePath, fileAnalyses);
  
  // Calculate module complexity
  const complexityScore = calculateModuleComplexity(fileAnalyses);
  
  // Identify module boundaries
  const boundaries = identifyModuleBoundaries(fileAnalyses, dependencies, exports);
  
  return {
    name: modulePath.split('/').pop() || modulePath,
    path: modulePath,
    type: moduleType,
    files: fileAnalyses,
    dependencies: Array.from(new Set(dependencies)),
    exports: Array.from(new Set(exports)),
    purpose: inferModulePurpose(modulePath, fileAnalyses),
    complexityScore,
    entryPoints,
    boundaries
  };
}

function determineModuleType(modulePath: string, files: FileAnalysis[]): 'module' | 'package' | 'service' | 'component' {
  const path = modulePath.toLowerCase();
  const fileNames = files.map(f => f.path.toLowerCase());
  
  if (path.includes('service') || fileNames.some(f => f.includes('service'))) {
    return 'service';
  }
  if (path.includes('component') || fileNames.some(f => f.includes('component'))) {
    return 'component';
  }
  if (path.includes('package') || fileNames.some(f => f.includes('package.json'))) {
    return 'package';
  }
  return 'module';
}

function calculateModuleComplexity(fileAnalyses: FileAnalysis[]): number {
  if (fileAnalyses.length === 0) return 0;
  
  const totalComplexity = fileAnalyses.reduce((sum, file) => sum + file.complexityScore, 0);
  const avgComplexity = totalComplexity / fileAnalyses.length;
  const fileCount = fileAnalyses.length;
  
  // Complexity increases with more files and higher average complexity
  return Math.min(10, Math.floor((avgComplexity * 0.7) + (fileCount * 0.3)));
}

function identifyModuleBoundaries(
  files: FileAnalysis[],
  dependencies: string[],
  exports: string[]
): { imports: string[]; exports: string[]; internalDependencies: string[] } {
  const allDependencies = Array.from(new Set(dependencies));
  const allExports = Array.from(new Set(exports));
  
  // Internal dependencies are those that reference other files in the same module
  const internalDependencies = allDependencies.filter(dep => 
    files.some(file => file.path.includes(dep) || dep.includes(file.path))
  );
  
  return {
    imports: allDependencies.filter(dep => !internalDependencies.includes(dep)),
    exports: allExports,
    internalDependencies
  };
}

function inferModulePurpose(modulePath: string, files: FileAnalysis[]): string {
  const path = modulePath.toLowerCase();
  const fileNames = files.map(f => f.path.toLowerCase());
  
  if (path.includes('test') || fileNames.some(f => f.includes('test'))) {
    return 'Testing and validation';
  }
  if (path.includes('config') || fileNames.some(f => f.includes('config'))) {
    return 'Configuration and settings';
  }
  if (path.includes('util') || path.includes('helper')) {
    return 'Utility functions and helpers';
  }
  if (path.includes('model') || path.includes('entity')) {
    return 'Data models and entities';
  }
  if (path.includes('service') || path.includes('api')) {
    return 'Business logic and API services';
  }
  if (path.includes('component') || path.includes('ui')) {
    return 'User interface components';
  }
  if (path.includes('middleware')) {
    return 'Request/response middleware';
  }
  
  return 'Core functionality';
}

function isEntryPoint(filename: string, path: string, content: string): boolean {
  const lowerContent = content.toLowerCase();
  
  // Main entry points
  if (filename === 'main.js' || filename === 'index.js' || filename === 'app.js') {
    return true;
  }
  
  // CLI entry points
  if (filename.includes('cli') || filename.includes('command')) {
    return true;
  }
  
  // Web entry points
  if (lowerContent.includes('express') || lowerContent.includes('app.listen')) {
    return true;
  }
  
  // Test entry points
  if (filename.includes('test') || filename.includes('spec')) {
    return true;
  }
  
  // Configuration entry points
  if (filename === 'package.json' || filename === 'webpack.config.js') {
    return true;
  }
  
  return false;
}

async function analyzeFile(path: string, content: string): Promise<FileAnalysis> {
  const language = getLanguageFromExtension(path);
  const purpose = inferFilePurpose(path.split('/').pop() || '', path, content);
  const dependencies = extractDependencies(content, language);
  const exports = extractExports(content, language);
  const complexityScore = calculateComplexity(content, language);
  
  return {
    path,
    purpose,
    dependencies,
    exports,
    complexityScore,
    lastModified: new Date().toISOString(),
    primaryAuthor: "Unknown", // Would need git blame
    size: Buffer.byteLength(content, 'utf8'),
    language
  };
}

function extractExports(content: string, language: string): string[] {
  const exports: string[] = [];
  
  if (language === 'JavaScript' || language === 'TypeScript') {
    // ES6 exports
    const exportMatches = content.match(/export\s+(?:default\s+)?(?:function|class|const|let|var)\s+([a-zA-Z_][a-zA-Z0-9_]*)/g);
    if (exportMatches) {
      exportMatches.forEach(match => {
        const name = match.match(/(?:function|class|const|let|var)\s+([a-zA-Z_][a-zA-Z0-9_]*)/)?.[1];
        if (name) exports.push(name);
      });
    }
    
    // CommonJS exports
    const moduleExports = content.match(/module\.exports\s*=\s*([a-zA-Z_][a-zA-Z0-9_]*)/g);
    if (moduleExports) {
      moduleExports.forEach(match => {
        const name = match.match(/=\s*([a-zA-Z_][a-zA-Z0-9_]*)/)?.[1];
        if (name) exports.push(name);
      });
    }
  } else if (language === 'Python') {
    // Python exports (from __all__ or function definitions)
    const allMatches = content.match(/__all__\s*=\s*\[([^\]]+)\]/);
    if (allMatches) {
      const names = allMatches[1].split(',').map(s => s.trim().replace(/['"]/g, ''));
      exports.push(...names);
    }
    
    // Function definitions
    const functionMatches = content.match(/def\s+([a-zA-Z_][a-zA-Z0-9_]*)/g);
    if (functionMatches) {
      functionMatches.forEach(match => {
        const name = match.replace('def ', '');
        exports.push(name);
      });
    }
  }
  
  return Array.from(new Set(exports));
}

async function detectArchitecturePatterns(modules: ModuleAnalysis[]): Promise<ArchitecturePattern> {
  const entryPoints = modules.flatMap(m => m.entryPoints);
  const moduleTypes = modules.map(m => m.type);
  const dependencies = modules.flatMap(m => m.dependencies);
  
  // Architecture pattern detection logic
  let pattern: 'monolith' | 'microservices' | 'modular' | 'layered' | 'event-driven' = 'monolith';
  let confidence = 0.5;
  const indicators: string[] = [];
  
  // Check for microservices indicators
  if (modules.some(m => m.type === 'service') && modules.length > 3) {
    pattern = 'microservices';
    confidence = 0.8;
    indicators.push('Multiple service modules detected');
  }
  
  // Check for modular architecture
  if (modules.length > 5 && moduleTypes.includes('module')) {
    pattern = 'modular';
    confidence = 0.7;
    indicators.push('Multiple modules with clear boundaries');
  }
  
  // Check for layered architecture
  if (modules.some(m => m.path.includes('controller')) && 
      modules.some(m => m.path.includes('service')) && 
      modules.some(m => m.path.includes('model'))) {
    pattern = 'layered';
    confidence = 0.9;
    indicators.push('Clear separation of controllers, services, and models');
  }
  
  // Check for event-driven patterns
  if (dependencies.some(d => d.includes('event') || d.includes('pubsub') || d.includes('kafka'))) {
    pattern = 'event-driven';
    confidence = 0.6;
    indicators.push('Event-driven dependencies detected');
  }
  
  return {
    type: pattern,
    confidence,
    indicators,
    modules,
    entryPoints: entryPoints.map(ep => ({
      path: ep,
      type: 'main' as const,
      purpose: 'Application entry point',
      dependencies: [],
      isPublic: true
    })),
    dataFlow: {
      inputs: [],
      outputs: [],
      transformations: []
    }
  };
}

// Main analysis function
async function analyzeGitHubRepository(url: string): Promise<GitHubAnalysisResult> {
  const startTime = Date.now();
  
  // Extract owner and repo from URL
  const urlMatch = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (!urlMatch) {
    throw new Error('Invalid GitHub URL format');
  }
  
  const [, owner, repo] = urlMatch;
  const repoName = repo.replace(/\.git$/, ''); // Remove .git suffix if present

  console.log(`🔍 Starting GitHub repository analysis for ${owner}/${repoName}`);

  try {
    // Fetch repository metadata
    console.log('📊 Fetching repository metadata...');
    const repo = await fetchGitHubRepo(owner, repoName);
    const metadata = extractRepoMetadata(repo);

    // Fetch repository contents
    console.log('📁 Fetching repository contents...');
    const contents = await fetchRepoContents(owner, repoName);

    // Analyze tech stack
    console.log('🔧 Analyzing technology stack...');
    const techStack = detectTechStack(contents);
    techStack.primaryLanguage = metadata.language;

    // Analyze directory structure recursively
    console.log('📁 Analyzing directory structure recursively...');
    const modules = await analyzeDirectoryRecursively(owner, repoName);

    // Detect architecture patterns
    console.log('🏗️ Detecting architecture patterns...');
    const architecture = await detectArchitecturePatterns(modules);

    // Create bounded contexts
    console.log('🏗️ Creating bounded contexts...');
    const contexts = createBoundedContexts(metadata, techStack, modules.flatMap(m => m.files));

    // Generate insights
    console.log('💡 Generating insights...');
    const insights = generateInsights(metadata, techStack, modules.flatMap(m => m.files));

    const analysisDuration = Date.now() - startTime;
    const estimatedCost = (analysisDuration / 1000 / 60) * 0.1; // $0.10 per minute

    const result: GitHubAnalysisResult = {
      repository: metadata,
      techStack,
      architecture,
      contexts,
      insights,
      metrics: {
        totalContexts: contexts.length,
        analysisDuration,
        estimatedCost
      }
    };

    console.log(`✅ GitHub repository analysis completed in ${analysisDuration}ms`);
    return result;

  } catch (error) {
    console.error('❌ GitHub repository analysis failed:', error);
    throw error;
  }
}

// Create the tool
export const githubRepoAnalysisTool = createTool({
  id: 'github-repo-analysis',
  description: 'Analyze GitHub repositories and create bounded contexts for codebase understanding',
  inputSchema: z.object({
    url: z.string().describe('GitHub repository URL to analyze'),
    userId: z.number().describe('User ID for context association'),
    profileId: z.number().optional().describe('Context profile ID (default: 0)'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    repository: z.object({
      url: z.string(),
      name: z.string(),
      description: z.string(),
      language: z.string(),
      size: z.number(),
      stars: z.number(),
      forks: z.number(),
      issues: z.number(),
      lastUpdated: z.string(),
      license: z.string().optional(),
      topics: z.array(z.string()),
      isArchived: z.boolean(),
      defaultBranch: z.string(),
    }),
    techStack: z.object({
      primaryLanguage: z.string(),
      buildFiles: z.array(z.string()),
      frameworks: z.array(z.string()),
      packageManagers: z.array(z.string()),
      databases: z.array(z.string()),
      deploymentTools: z.array(z.string()),
    }),
    contexts: z.array(z.object({
      id: z.string(),
      name: z.string(),
      type: z.string(),
      description: z.string(),
      data: z.any(),
      relationships: z.array(z.string()),
      lastUpdated: z.string(),
      cost: z.number(),
    })),
    insights: z.object({
      risks: z.array(z.string()),
      improvements: z.array(z.string()),
      opportunities: z.array(z.string()),
    }),
    metrics: z.object({
      totalContexts: z.number(),
      analysisDuration: z.number(),
      estimatedCost: z.number(),
    }),
    message: z.string(),
  }),
  execute: async ({ context }) => {
    if (!context) {
      throw new Error('Context not found');
    }

    const { url, userId, profileId = 0 } = context;

    try {
      console.log(`🚀 Starting GitHub repository analysis for: ${url}`);
      console.log(`👤 User ID: ${userId}, Profile ID: ${profileId}`);

      // Perform the analysis
      const analysis = await analyzeGitHubRepository(url);

      // Save analysis results to database
      console.log('💾 Saving analysis results to database...');
      
      // Create a URL record for the GitHub repo
      const urlRecord = await storage.createUrl(userId, {
        url,
        title: analysis.repository.name,
        notes: `GitHub Repository Analysis\n\n${analysis.repository.description}\n\nLanguage: ${analysis.repository.language}\nStars: ${analysis.repository.stars}\nForks: ${analysis.repository.forks}\nIssues: ${analysis.repository.issues}`
      });

      // Save the analysis as content
      const analysisContent = JSON.stringify(analysis, null, 2);
      await storage.updateUrlContent(urlRecord.id, userId, analysisContent);

      // Save insights as analysis
      const insightsAnalysis = {
        summary: `GitHub Repository Analysis for ${analysis.repository.name}`,
        insights: analysis.insights,
        techStack: analysis.techStack,
        metrics: analysis.metrics,
        timestamp: new Date().toISOString(),
        model: 'github-analyzer'
      };
      await storage.updateUrlAnalysis(urlRecord.id, userId, insightsAnalysis);

      console.log(`✅ GitHub repository analysis completed successfully`);
      console.log(`   Repository: ${analysis.repository.name}`);
      console.log(`   Language: ${analysis.repository.language}`);
      console.log(`   Contexts: ${analysis.metrics.totalContexts}`);
      console.log(`   Duration: ${analysis.metrics.analysisDuration}ms`);
      console.log(`   Cost: $${analysis.metrics.estimatedCost.toFixed(2)}`);

      return {
        success: true,
        repository: analysis.repository,
        techStack: analysis.techStack,
        contexts: analysis.contexts,
        insights: analysis.insights,
        metrics: analysis.metrics,
        message: `Successfully analyzed GitHub repository: ${analysis.repository.name} (${analysis.metrics.totalContexts} contexts created, ${analysis.metrics.analysisDuration}ms, $${analysis.metrics.estimatedCost.toFixed(2)})`
      };

    } catch (error) {
      console.error('❌ GitHub repository analysis failed:', error);
      return {
        success: false,
        repository: {
          url: '',
          name: '',
          description: '',
          language: '',
          size: 0,
          stars: 0,
          forks: 0,
          issues: 0,
          lastUpdated: '',
          topics: [],
          isArchived: false,
          defaultBranch: ''
        },
        techStack: {
          primaryLanguage: '',
          buildFiles: [],
          frameworks: [],
          packageManagers: [],
          databases: [],
          deploymentTools: []
        },
        contexts: [],
        insights: {
          risks: [],
          improvements: [],
          opportunities: []
        },
        metrics: {
          totalContexts: 0,
          analysisDuration: 0,
          estimatedCost: 0
        },
        message: `Failed to analyze GitHub repository: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  },
}); 