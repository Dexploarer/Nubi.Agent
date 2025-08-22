//#!/usr/bin/env bun

/**
 * End-to-End Test Runner for NUBI/XMCP
 * Following ElizaOS Testing Patterns
 */

import { spawn } from 'child_process';
import chalk from 'chalk';
import ora from 'ora';

interface TestResult {
    suite: string;
    passed: number;
    failed: number;
    duration: number;
    failures: string[];
}

class E2ETestRunner {
    private results: TestResult[] = [];
    private startTime: number = 0;

    async run() {
        console.log(chalk.cyan.bold('\n🧪 NUBI/XMCP End-to-End Test Suite\n'));
        console.log(chalk.gray('Following ElizaOS Bootstrap Testing Patterns\n'));

        this.startTime = Date.now();

        // Test suites to run
        const testSuites = [
            {
                name: 'Unit Tests',
                path: 'src/__tests__/test-utils.ts',
                description: 'Test utilities and mocks'
            },
            {
                name: 'Integration Tests',
                path: 'src/__tests__/integration.test.ts',
                description: 'Service and event integration'
            }
        ];

        for (const suite of testSuites) {
            await this.runTestSuite(suite);
        }

        this.printSummary();
    }

    private async runTestSuite(suite: { name: string; path: string; description: string }): Promise<void> {
        const spinner = ora({
            text: `Running ${suite.name}...`,
            color: 'cyan'
        }).start();

        try {
            const result = await this.executeTests(suite.path);
            
            if (result.failed === 0) {
                spinner.succeed(chalk.green(`✓ ${suite.name}: ${result.passed} tests passed`));
            } else {
                spinner.fail(chalk.red(`✗ ${suite.name}: ${result.failed} tests failed`));
            }

            this.results.push({
                suite: suite.name,
                ...result
            });
        } catch (error) {
            spinner.fail(chalk.red(`✗ ${suite.name}: Test execution failed`));
            this.results.push({
                suite: suite.name,
                passed: 0,
                failed: 1,
                duration: 0,
                failures: [error.message]
            });
        }
    }

    private executeTests(path: string): Promise<TestResult> {
        return new Promise((resolve, reject) => {
            const testProcess = spawn('bun', ['test', path], {
                stdio: 'pipe',
                env: { ...process.env, NODE_ENV: 'test' }
            });

            let output = '';
            let errorOutput = '';

            testProcess.stdout.on('data', (data) => {
                output += data.toString();
            });

            testProcess.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });

            testProcess.on('close', (code) => {
                const result = this.parseTestOutput(output, errorOutput);
                
                if (code === 0) {
                    resolve(result);
                } else {
                    resolve({
                        ...result,
                        failed: result.failed || 1
                    });
                }
            });

            testProcess.on('error', (error) => {
                reject(error);
            });
        });
    }

    private parseTestOutput(output: string, errorOutput: string): TestResult {
        // Parse Bun test output
        const passedMatch = output.match(/(\d+) pass/);
        const failedMatch = output.match(/(\d+) fail/);
        const durationMatch = output.match(/\[(\d+\.\d+)ms\]/);

        const passed = passedMatch ? parseInt(passedMatch[1]) : 0;
        const failed = failedMatch ? parseInt(failedMatch[1]) : 0;
        const duration = durationMatch ? parseFloat(durationMatch[1]) : 0;

        // Extract failure messages
        const failures: string[] = [];
        const failureRegex = /✗ (.+)\n\s+(.+)/g;
        let match;
        while ((match = failureRegex.exec(output)) !== null) {
            failures.push(`${match[1]}: ${match[2]}`);
        }

        return {
            suite: '',
            passed,
            failed,
            duration,
            failures
        };
    }

    private printSummary() {
        const totalDuration = Date.now() - this.startTime;
        const totalPassed = this.results.reduce((sum, r) => sum + r.passed, 0);
        const totalFailed = this.results.reduce((sum, r) => sum + r.failed, 0);

        console.log(chalk.cyan.bold('\n📊 Test Summary\n'));

        // Print table
        console.log(chalk.gray('┌─────────────────────────┬─────────┬─────────┬──────────┐'));
        console.log(chalk.gray('│ Suite                   │ Passed  │ Failed  │ Duration │'));
        console.log(chalk.gray('├─────────────────────────┼─────────┼─────────┼──────────┤'));

        for (const result of this.results) {
            const passedStr = result.passed.toString().padStart(7);
            const failedStr = result.failed.toString().padStart(7);
            const durationStr = `${result.duration.toFixed(0)}ms`.padStart(8);
            const suiteStr = result.suite.padEnd(23);

            const row = `│ ${suiteStr} │ ${
                result.passed > 0 ? chalk.green(passedStr) : passedStr
            } │ ${
                result.failed > 0 ? chalk.red(failedStr) : failedStr
            } │ ${durationStr} │`;

            console.log(chalk.gray(row));
        }

        console.log(chalk.gray('└─────────────────────────┴─────────┴─────────┴──────────┘'));

        // Print totals
        console.log('\n' + chalk.cyan('Total Tests:'), totalPassed + totalFailed);
        console.log(chalk.green('Passed:'), totalPassed);
        console.log(chalk.red('Failed:'), totalFailed);
        console.log(chalk.gray('Duration:'), `${(totalDuration / 1000).toFixed(2)}s`);

        // Print failures if any
        if (totalFailed > 0) {
            console.log(chalk.red.bold('\n❌ Failures:\n'));
            for (const result of this.results) {
                if (result.failures.length > 0) {
                    console.log(chalk.red(`${result.suite}:`));
                    for (const failure of result.failures) {
                        console.log(chalk.gray(`  - ${failure}`));
                    }
                }
            }
        }

        // Final status
        console.log();
        if (totalFailed === 0) {
            console.log(chalk.green.bold('✅ All tests passed!'));
            console.log(chalk.gray('Your NUBI/XMCP integration is working correctly with ElizaOS'));
        } else {
            console.log(chalk.red.bold('❌ Some tests failed'));
            console.log(chalk.gray('Please review the failures above and fix the issues'));
        }

        // Exit code
        process.exit(totalFailed > 0 ? 1 : 0);
    }
}

// Run tests
const runner = new E2ETestRunner();
runner.run().catch(error => {
    console.error(chalk.red('Test runner failed:'), error);
    process.exit(1);
});
