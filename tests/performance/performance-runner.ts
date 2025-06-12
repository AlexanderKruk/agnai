/**
 * Performance Test Runner
 * 
 * Comprehensive performance test suite with reporting and metrics collection
 */

import { spawn } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

interface PerformanceReport {
  timestamp: string
  testSuite: string
  totalTests: number
  passedTests: number
  failedTests: number
  duration: number
  metrics: {
    averageResponseTime: number
    requestsPerSecond: number
    memoryUsage: number
    cpuUsage?: number
  }
  summary: string
}

class PerformanceReporter {
  private reports: PerformanceReport[] = []
  private startTime: number = Date.now()

  addReport(report: PerformanceReport) {
    this.reports.push(report)
  }

  generateSummary(): string {
    const totalDuration = Date.now() - this.startTime
    const totalTests = this.reports.reduce((sum, r) => sum + r.totalTests, 0)
    const totalPassed = this.reports.reduce((sum, r) => sum + r.passedTests, 0)
    const totalFailed = this.reports.reduce((sum, r) => sum + r.failedTests, 0)

    const avgResponseTime = this.reports.length > 0
      ? this.reports.reduce((sum, r) => sum + r.metrics.averageResponseTime, 0) / this.reports.length
      : 0

    const avgRequestsPerSecond = this.reports.length > 0
      ? this.reports.reduce((sum, r) => sum + r.metrics.requestsPerSecond, 0) / this.reports.length
      : 0

    const peakMemoryUsage = Math.max(...this.reports.map(r => r.metrics.memoryUsage))

    return `
🚀 Performance Test Summary
===============================
Total Duration: ${(totalDuration / 1000).toFixed(1)}s
Total Tests: ${totalTests}
Passed: ${totalPassed} (${((totalPassed / totalTests) * 100).toFixed(1)}%)
Failed: ${totalFailed} (${((totalFailed / totalTests) * 100).toFixed(1)}%)

📊 Performance Metrics:
- Average Response Time: ${avgResponseTime.toFixed(0)}ms
- Average Requests/Second: ${avgRequestsPerSecond.toFixed(1)}
- Peak Memory Usage: ${(peakMemoryUsage / 1024 / 1024).toFixed(1)}MB

📈 Test Suite Results:
${this.reports.map(r => 
  `- ${r.testSuite}: ${r.passedTests}/${r.totalTests} (${((r.passedTests / r.totalTests) * 100).toFixed(1)}%) - ${r.metrics.averageResponseTime.toFixed(0)}ms avg`
).join('\n')}

${totalFailed === 0 ? '✅ All performance tests passed!' : '⚠️  Some performance tests failed - check individual results'}
`
  }

  saveReport(outputPath: string) {
    const report = {
      generatedAt: new Date().toISOString(),
      summary: this.generateSummary(),
      detailedReports: this.reports,
      metadata: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        memoryLimit: process.memoryUsage()
      }
    }

    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2))
    console.log(`📄 Performance report saved to: ${outputPath}`)
  }
}

async function runPerformanceTest(testFile: string): Promise<PerformanceReport> {
  return new Promise((resolve, reject) => {
    console.log(`🔥 Running performance test: ${testFile}`)
    
    const startTime = Date.now()
    const testProcess = spawn('npx', [
      'mocha', 
      testFile,
      '--require', 'ts-node/register',
      '--timeout', '120000', // 2 minute timeout
      '--reporter', 'json'
    ], {
      stdio: ['inherit', 'pipe', 'pipe'],
      env: { ...process.env, NODE_ENV: 'test' }
    })

    let stdout = ''
    let stderr = ''

    testProcess.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    testProcess.stderr.on('data', (data) => {
      stderr += data.toString()
      // Also show errors in real-time
      process.stderr.write(data)
    })

    testProcess.on('close', (code) => {
      const duration = Date.now() - startTime
      
      try {
        // Parse Mocha JSON output
        const result = JSON.parse(stdout)
        
        const report: PerformanceReport = {
          timestamp: new Date().toISOString(),
          testSuite: path.basename(testFile, '.ts'),
          totalTests: result.stats.tests,
          passedTests: result.stats.passes,
          failedTests: result.stats.failures,
          duration,
          metrics: {
            averageResponseTime: 0, // Would be extracted from test output
            requestsPerSecond: 0,   // Would be extracted from test output
            memoryUsage: process.memoryUsage().heapUsed
          },
          summary: `${result.stats.passes}/${result.stats.tests} tests passed in ${duration}ms`
        }

        resolve(report)
      } catch (error) {
        // If JSON parsing fails, create a basic report
        const report: PerformanceReport = {
          timestamp: new Date().toISOString(),
          testSuite: path.basename(testFile, '.ts'),
          totalTests: 0,
          passedTests: code === 0 ? 1 : 0,
          failedTests: code === 0 ? 0 : 1,
          duration,
          metrics: {
            averageResponseTime: 0,
            requestsPerSecond: 0,
            memoryUsage: process.memoryUsage().heapUsed
          },
          summary: code === 0 ? 'Test completed successfully' : `Test failed with code ${code}`
        }

        if (code === 0) {
          resolve(report)
        } else {
          reject(new Error(`Test failed with code ${code}: ${stderr}`))
        }
      }
    })
  })
}

async function runAllPerformanceTests() {
  console.log('🚀 Starting Performance Test Suite')
  console.log('==================================')

  const reporter = new PerformanceReporter()
  const testDir = path.join(__dirname)
  
  // Find all performance test files
  const testFiles = fs.readdirSync(testDir)
    .filter(file => file.endsWith('.spec.ts'))
    .map(file => path.join(testDir, file))

  console.log(`Found ${testFiles.length} performance test suites`)

  // Run tests sequentially to avoid resource conflicts
  for (const testFile of testFiles) {
    try {
      const report = await runPerformanceTest(testFile)
      reporter.addReport(report)
      console.log(`✅ Completed: ${report.testSuite} (${report.passedTests}/${report.totalTests})`)
    } catch (error) {
      console.error(`❌ Failed: ${path.basename(testFile)}`)
      console.error((error as Error).message)
      
      // Add failed report
      reporter.addReport({
        timestamp: new Date().toISOString(),
        testSuite: path.basename(testFile, '.spec.ts'),
        totalTests: 1,
        passedTests: 0,
        failedTests: 1,
        duration: 0,
        metrics: {
          averageResponseTime: 0,
          requestsPerSecond: 0,
          memoryUsage: process.memoryUsage().heapUsed
        },
        summary: `Test suite failed: ${(error as Error).message}`
      })
    }
  }

  // Generate and display summary
  const summary = reporter.generateSummary()
  console.log(summary)

  // Save detailed report
  const reportPath = path.join(process.cwd(), 'performance-report.json')
  reporter.saveReport(reportPath)

  // Return exit code based on results
  const hasFailures = reporter['reports'].some(r => r.failedTests > 0)
  process.exit(hasFailures ? 1 : 0)
}

// Check if this script is being run directly
if (require.main === module) {
  runAllPerformanceTests().catch(error => {
    console.error('💥 Performance test runner failed:', error)
    process.exit(1)
  })
}

export { runAllPerformanceTests, PerformanceReporter }