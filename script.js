// AWS AppSync GraphQL Simulator
class AppSyncSimulator {
    constructor() {
        this.stats = {
            totalOperations: 0,
            queryCount: 0,
            mutationCount: 0,
            subscriptionCount: 0
        };
        
        this.currentOperation = 'query';
        this.currentDataSource = 'dynamodb';
        this.currentResolver = 'vtl';
        this.activeSubscriptions = new Set();
        this.subscriptionId = 1;
        
        this.operationHistory = [];
        this.cache = new Map();
        
        this.initializeEventListeners();
        this.updateDisplay();
        this.loadSampleOperations();
    }

    initializeEventListeners() {
        // Operation type tabs
        document.querySelectorAll('.operation-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchOperation(e.target.dataset.operation);
            });
        });

        // Data source selection
        document.querySelectorAll('.source-card').forEach(card => {
            card.addEventListener('click', (e) => {
                this.selectDataSource(e.currentTarget.dataset.source);
            });
        });

        // Resolver type selection
        document.querySelectorAll('.resolver-card').forEach(card => {
            card.addEventListener('click', (e) => {
                this.selectResolver(e.currentTarget.dataset.resolver);
            });
        });

        // Schema tabs
        document.querySelectorAll('.schema-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchSchemaTab(e.target.dataset.tab);
            });
        });

        // Code tabs
        document.querySelectorAll('.code-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchCodeTab(e.target.dataset.tab);
            });
        });
    }

    loadSampleOperations() {
        const sampleOperations = {
            query: `query GetUser {
  getUser(id: "123") {
    id
    name
    email
    posts {
      id
      title
      content
    }
  }
}`,
            mutation: `mutation CreatePost {
  createPost(input: {
    title: "My New Post"
    content: "This is the content of my post"
    authorId: "123"
  }) {
    id
    title
    content
    author {
      name
    }
  }
}`,
            subscription: `subscription OnCreatePost {
  onCreatePost {
    id
    title
    content
    author {
      id
      name
    }
    createdAt
  }
}`
        };

        document.getElementById('graphql-query').value = sampleOperations[this.currentOperation];
    }

    switchOperation(operationType) {
        this.currentOperation = operationType;
        
        // Update active tab
        document.querySelectorAll('.operation-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-operation="${operationType}"]`).classList.add('active');

        // Load sample operation
        this.loadSampleOperations();
        
        this.logOperation(`Switched to ${operationType.toUpperCase()} operation`, 'info');
    }

    selectDataSource(sourceType) {
        this.currentDataSource = sourceType;
        
        // Update active data source
        document.querySelectorAll('.source-card').forEach(card => {
            card.classList.remove('active');
        });
        document.querySelector(`[data-source="${sourceType}"]`).classList.add('active');

        // Update data source display
        const sourceNames = {
            dynamodb: 'DynamoDB',
            lambda: 'Lambda Function',
            elasticsearch: 'OpenSearch',
            http: 'HTTP Endpoint'
        };
        
        document.getElementById('datasource-type').textContent = sourceNames[sourceType];
        this.logOperation(`Selected ${sourceNames[sourceType]} data source`, 'info');
    }

    selectResolver(resolverType) {
        this.currentResolver = resolverType;
        
        // Update active resolver
        document.querySelectorAll('.resolver-card').forEach(card => {
            card.classList.remove('active');
        });
        document.querySelector(`[data-resolver="${resolverType}"]`).classList.add('active');

        const resolverNames = {
            vtl: 'VTL (Velocity)',
            javascript: 'JavaScript',
            pipeline: 'Pipeline',
            direct: 'Direct Lambda'
        };
        
        this.logOperation(`Selected ${resolverNames[resolverType]} resolver`, 'info');
    }  
  async executeOperation() {
        const query = document.getElementById('graphql-query').value.trim();
        
        if (!query) {
            alert('Please enter a GraphQL operation');
            return;
        }

        const operation = {
            id: Date.now(),
            type: this.currentOperation,
            query: query,
            dataSource: this.currentDataSource,
            resolver: this.currentResolver,
            timestamp: new Date()
        };

        this.stats.totalOperations++;
        this.stats[`${this.currentOperation}Count`]++;
        this.operationHistory.push(operation);

        this.logOperation(`Executing ${this.currentOperation.toUpperCase()}: ${this.extractOperationName(query)}`, 'info');
        this.resetFlowStates();
        
        // Start execution flow
        await this.processOperationFlow(operation);
    }

    extractOperationName(query) {
        const match = query.match(/(?:query|mutation|subscription)\s+(\w+)/);
        return match ? match[1] : 'Anonymous';
    }

    async processOperationFlow(operation) {
        try {
            // Step 1: Client sends operation
            this.updateFlowStep('client', 'active', 'Sending Operation');
            await this.delay(300);

            // Step 2: AppSync receives and validates
            this.updateFlowStep('client', 'success', 'Operation Sent');
            this.updateFlowStep('appsync', 'processing', 'Validating');
            await this.delay(200);

            // Step 3: Authentication
            const authResult = await this.checkAuthentication(operation);
            if (!authResult.success) {
                await this.handleOperationFailure(operation, 'Authentication Failed');
                return;
            }

            // Step 4: Resolver execution
            const resolverResult = await this.executeResolver(operation);
            if (!resolverResult.success) {
                await this.handleOperationFailure(operation, 'Resolver Error');
                return;
            }

            // Step 5: Caching check
            const cacheResult = await this.checkCache(operation);
            if (cacheResult.hit) {
                await this.handleCacheHit(operation, cacheResult.data);
                return;
            }

            // Step 6: Data source execution
            this.updateFlowStep('appsync', 'success', 'Validated');
            this.updateFlowStep('datasource', 'processing', 'Executing');
            await this.delay(this.getDataSourceLatency());

            const dataResult = await this.executeDataSource(operation);
            
            // Step 7: Response processing
            this.updateFlowStep('datasource', 'success', 'Completed');
            this.updateFlowStep('response', 'processing', 'Processing Response');
            await this.delay(100);

            // Cache the response
            this.cacheResponse(operation, dataResult);

            await this.handleSuccessResponse(operation, dataResult);

        } catch (error) {
            await this.handleOperationFailure(operation, 'Internal Error');
        }
    }

    async checkAuthentication(operation) {
        await this.delay(100);

        // Simulate authentication based on operation type
        const authSuccess = Math.random() > 0.1; // 90% success rate
        
        if (authSuccess) {
            document.getElementById('auth-result').textContent = 'Passed';
            document.getElementById('auth-result').className = 'detail-value success';
            this.logOperation('Authentication successful', 'success');
            return { success: true };
        } else {
            document.getElementById('auth-result').textContent = 'Failed';
            document.getElementById('auth-result').className = 'detail-value error';
            this.logOperation('Authentication failed: Invalid credentials', 'error');
            return { success: false };
        }
    }

    async executeResolver(operation) {
        await this.delay(150);

        const resolverLatencies = {
            vtl: 50,
            javascript: 100,
            pipeline: 200,
            direct: 300
        };

        await this.delay(resolverLatencies[this.currentResolver]);

        // Simulate resolver success/failure
        const resolverSuccess = Math.random() > 0.05; // 95% success rate
        
        if (resolverSuccess) {
            document.getElementById('resolver-result').textContent = this.currentResolver.toUpperCase();
            document.getElementById('resolver-result').className = 'detail-value success';
            this.logOperation(`${this.currentResolver.toUpperCase()} resolver executed successfully`, 'success');
            return { success: true };
        } else {
            document.getElementById('resolver-result').textContent = 'Error';
            document.getElementById('resolver-result').className = 'detail-value error';
            this.logOperation(`${this.currentResolver.toUpperCase()} resolver failed`, 'error');
            return { success: false };
        }
    }

    async checkCache(operation) {
        await this.delay(50);

        // Only queries can be cached
        if (operation.type !== 'query') {
            document.getElementById('cache-result').textContent = 'N/A';
            document.getElementById('cache-result').className = 'detail-value';
            return { hit: false };
        }

        const cacheKey = `${operation.type}:${this.extractOperationName(operation.query)}`;
        const cachedData = this.cache.get(cacheKey);

        if (cachedData && Date.now() - cachedData.timestamp < 300000) { // 5 min TTL
            document.getElementById('cache-result').textContent = 'Hit';
            document.getElementById('cache-result').className = 'detail-value success';
            this.logOperation('Cache hit: Returning cached response', 'success');
            return { hit: true, data: cachedData.data };
        }

        document.getElementById('cache-result').textContent = 'Miss';
        document.getElementById('cache-result').className = 'detail-value warning';
        this.logOperation('Cache miss: Proceeding to data source', 'info');
        return { hit: false };
    }

    async executeDataSource(operation) {
        const dataSourceLatencies = {
            dynamodb: { min: 20, max: 100 },
            lambda: { min: 100, max: 500 },
            elasticsearch: { min: 50, max: 200 },
            http: { min: 200, max: 1000 }
        };

        const latency = dataSourceLatencies[this.currentDataSource];
        const actualLatency = Math.random() * (latency.max - latency.min) + latency.min;
        
        await this.delay(actualLatency);

        // Simulate occasional data source errors
        const errorRate = this.currentDataSource === 'http' ? 0.1 : 0.03;
        if (Math.random() < errorRate) {
            throw new Error('Data source error');
        }

        const mockData = this.generateMockData(operation);
        this.logOperation(`${this.currentDataSource.toUpperCase()} responded in ${Math.round(actualLatency)}ms`, 'success');
        
        return {
            data: mockData,
            latency: actualLatency
        };
    }

    generateMockData(operation) {
        const operationName = this.extractOperationName(operation.query);
        
        const mockResponses = {
            GetUser: {
                getUser: {
                    id: "123",
                    name: "John Doe",
                    email: "john@example.com",
                    posts: [
                        { id: "1", title: "First Post", content: "Hello World!" },
                        { id: "2", title: "Second Post", content: "GraphQL is awesome!" }
                    ]
                }
            },
            CreatePost: {
                createPost: {
                    id: "3",
                    title: "My New Post",
                    content: "This is the content of my post",
                    author: { name: "John Doe" }
                }
            }
        };

        return mockResponses[operationName] || { message: "Operation completed successfully" };
    } 
   cacheResponse(operation, result) {
        if (operation.type === 'query') {
            const cacheKey = `${operation.type}:${this.extractOperationName(operation.query)}`;
            this.cache.set(cacheKey, {
                data: result.data,
                timestamp: Date.now()
            });
            this.logOperation('Response cached for future queries', 'info');
        }
    }

    async handleCacheHit(operation, data) {
        this.updateFlowStep('appsync', 'success', 'Cache Hit');
        this.updateFlowStep('datasource', '', 'Skipped');
        this.updateFlowStep('response', 'success', 'Cached Response');
        
        document.getElementById('response-time').textContent = '~5ms';
        
        this.logOperation('Operation completed with cached response (~5ms)', 'success');
        this.updateDisplay();
    }

    async handleSuccessResponse(operation, result) {
        this.updateFlowStep('response', 'success', 'Response Sent');
        
        document.getElementById('response-time').textContent = `${Math.round(result.latency)}ms`;
        
        this.logOperation(`Operation completed successfully in ${Math.round(result.latency)}ms`, 'success');
        this.updateDisplay();

        // If this was a mutation, trigger subscription updates
        if (operation.type === 'mutation') {
            this.triggerSubscriptionUpdates(operation, result.data);
        }
    }

    async handleOperationFailure(operation, reason) {
        this.updateFlowStep('appsync', 'error', 'Failed');
        this.updateFlowStep('datasource', '', 'Skipped');
        this.updateFlowStep('response', 'error', reason);
        
        this.logOperation(`Operation failed: ${reason}`, 'error');
        this.updateDisplay();
    }

    updateFlowStep(stepType, state, status) {
        const step = document.querySelector(`.${stepType}-step`);
        const statusElement = document.getElementById(`${stepType}-status`);
        
        // Remove all state classes
        step.classList.remove('active', 'processing', 'success', 'error');
        
        // Add new state class
        if (state) {
            step.classList.add(state);
        }
        
        // Update status text
        if (statusElement && status) {
            statusElement.textContent = status;
        }
    }

    resetFlowStates() {
        const steps = document.querySelectorAll('.flow-step');
        steps.forEach(step => {
            step.classList.remove('active', 'processing', 'success', 'error');
        });

        // Reset status texts
        document.getElementById('client-status').textContent = 'Ready';
        document.getElementById('appsync-status').textContent = 'Waiting';
        document.getElementById('datasource-status').textContent = 'Idle';
        document.getElementById('response-status').textContent = '-';
        document.getElementById('response-time').textContent = '-';
        
        // Reset detail values
        document.getElementById('auth-result').textContent = '-';
        document.getElementById('auth-result').className = 'detail-value';
        document.getElementById('resolver-result').textContent = '-';
        document.getElementById('resolver-result').className = 'detail-value';
        document.getElementById('cache-result').textContent = '-';
        document.getElementById('cache-result').className = 'detail-value';
    }

    getDataSourceLatency() {
        const latencies = {
            dynamodb: 75,
            lambda: 200,
            elasticsearch: 100,
            http: 400
        };
        return latencies[this.currentDataSource] || 100;
    }

    startSubscription() {
        const subscriptionId = `sub-${this.subscriptionId++}`;
        this.activeSubscriptions.add(subscriptionId);
        this.stats.subscriptionCount = this.activeSubscriptions.size;
        
        this.logOperation(`Started subscription: ${subscriptionId}`, 'success');
        this.addSubscriptionMessage(`Subscription ${subscriptionId} started - listening for updates...`);
        this.updateDisplay();
    }

    stopSubscription() {
        if (this.activeSubscriptions.size === 0) {
            this.logOperation('No active subscriptions to stop', 'warning');
            return;
        }

        const subscriptionId = Array.from(this.activeSubscriptions)[0];
        this.activeSubscriptions.delete(subscriptionId);
        this.stats.subscriptionCount = this.activeSubscriptions.size;
        
        this.logOperation(`Stopped subscription: ${subscriptionId}`, 'info');
        this.addSubscriptionMessage(`Subscription ${subscriptionId} stopped`);
        this.updateDisplay();
    }

    triggerUpdate() {
        if (this.activeSubscriptions.size === 0) {
            this.logOperation('No active subscriptions to trigger', 'warning');
            return;
        }

        const updateData = {
            id: Date.now().toString(),
            title: "Real-time Update",
            content: "This is a real-time update triggered by a mutation",
            author: { name: "Jane Smith" },
            createdAt: new Date().toISOString()
        };

        this.activeSubscriptions.forEach(subId => {
            this.addSubscriptionMessage(`[${subId}] New post created: ${updateData.title}`, true);
        });

        this.logOperation('Triggered subscription updates for all active subscriptions', 'success');
    }

    triggerSubscriptionUpdates(operation, data) {
        if (this.activeSubscriptions.size === 0) return;

        const operationName = this.extractOperationName(operation.query);
        
        this.activeSubscriptions.forEach(subId => {
            this.addSubscriptionMessage(`[${subId}] Mutation ${operationName} triggered update`, true);
        });
    }

    addSubscriptionMessage(message, isNew = false) {
        const feed = document.getElementById('subscription-feed');
        const messageEl = document.createElement('div');
        messageEl.className = `feed-message ${isNew ? 'new' : ''}`;
        messageEl.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        
        feed.appendChild(messageEl);
        feed.scrollTop = feed.scrollHeight;

        // Keep only last 50 messages
        while (feed.children.length > 50) {
            feed.removeChild(feed.firstChild);
        }
    }

    updateDisplay() {
        document.getElementById('total-operations').textContent = this.stats.totalOperations;
        document.getElementById('query-count').textContent = this.stats.queryCount;
        document.getElementById('mutation-count').textContent = this.stats.mutationCount;
        document.getElementById('subscription-count').textContent = this.stats.subscriptionCount;
    }

    switchSchemaTab(tabName) {
        // Update active tab
        document.querySelectorAll('.schema-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Show corresponding schema
        document.querySelectorAll('.schema-content pre').forEach(pre => {
            pre.style.display = 'none';
        });
        document.getElementById(`${tabName}-schema`).style.display = 'block';
    }

    switchCodeTab(tabName) {
        // Update active tab
        document.querySelectorAll('.code-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Show corresponding code
        document.querySelectorAll('.code-content pre').forEach(pre => {
            pre.style.display = 'none';
        });
        document.getElementById(`${tabName}-code`).style.display = 'block';
    }

    logOperation(message, type = 'info') {
        const logContent = document.getElementById('log-content');
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry ${type}`;
        logEntry.textContent = `[${timestamp}] ${message}`;
        
        logContent.appendChild(logEntry);
        logContent.scrollTop = logContent.scrollHeight;

        // Keep only last 100 entries
        while (logContent.children.length > 100) {
            logContent.removeChild(logContent.firstChild);
        }

        // Also log to console
        console.log(`[AppSync] ${message}`);
    }

    clearLog() {
        const logContent = document.getElementById('log-content');
        logContent.innerHTML = '<div class="log-entry">Log cleared. Ready for new operations...</div>';
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Global functions for HTML onclick handlers
let appSyncSimulator;

function executeOperation() {
    appSyncSimulator.executeOperation();
}

function startSubscription() {
    appSyncSimulator.startSubscription();
}

function stopSubscription() {
    appSyncSimulator.stopSubscription();
}

function triggerUpdate() {
    appSyncSimulator.triggerUpdate();
}

function clearLog() {
    appSyncSimulator.clearLog();
}

// Initialize simulator when page loads
document.addEventListener('DOMContentLoaded', () => {
    appSyncSimulator = new AppSyncSimulator();
    
    console.log('=== AWS AppSync GraphQL Simulator ===');
    console.log('Features: GraphQL Operations, Real-time Subscriptions, Multiple Data Sources');
    console.log('Data Sources: DynamoDB, Lambda, OpenSearch, HTTP');
    console.log('Resolver Types: VTL, JavaScript, Pipeline, Direct Lambda');
    console.log('=== Try different GraphQL operations and see the complete flow! ===');
});