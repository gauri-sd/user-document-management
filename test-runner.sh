#!/bin/bash

echo "🧪 Running Unit Tests for User Document Management System"
echo "=================================================="

# Set environment variables for testing
export NODE_ENV=test

# Run tests with coverage
echo "📊 Running tests with coverage..."
npm test -- --coverage --verbose

# Run specific test suites
echo ""
echo "🔍 Running specific test suites..."

echo "👥 Testing Users Service..."
npm test -- --testPathPattern=users.service.spec.ts --verbose

echo "🔐 Testing Auth Service..."
npm test -- --testPathPattern=auth.service.spec.ts --verbose

echo "📄 Testing Documents Service..."
npm test -- --testPathPattern=documents.service.spec.ts --verbose

echo ""
echo "✅ All tests completed!"
echo "📈 Check coverage report in coverage/ directory" 