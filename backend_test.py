#!/usr/bin/env python3

import requests
import json
import sys
from datetime import datetime
import io
import os

class TemplateEditorAPITester:
    def __init__(self, base_url="https://design-merger.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.template_id = None
        self.datasource_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, files=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'} if not files else {}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                if files:
                    response = requests.post(url, files=files)
                else:
                    response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return success, response.json() if response.content else {}
                except:
                    return success, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Response: {response.text[:200]}")

            return success, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_root_endpoint(self):
        """Test root API endpoint"""
        success, response = self.run_test(
            "Root API Endpoint",
            "GET",
            "api/",
            200
        )
        return success

    def test_create_template(self):
        """Test template creation"""
        template_data = {
            "name": f"Test Template {datetime.now().strftime('%H%M%S')}",
            "description": "Test template for API testing",
            "settings": {
                "width": 800,
                "height": 600,
                "backgroundColor": "#ffffff",
                "snapToGrid": True,
                "gridSize": 10,
                "showGrid": True
            },
            "elements": [
                {
                    "type": "text",
                    "name": "Test Text",
                    "x": 100,
                    "y": 100,
                    "width": 200,
                    "height": 50,
                    "content": "Hello World",
                    "style": {
                        "fill": "#000000",
                        "stroke": "#000000",
                        "strokeWidth": 1,
                        "opacity": 1
                    },
                    "textStyle": {
                        "fontFamily": "Arial",
                        "fontSize": 16,
                        "color": "#000000"
                    }
                }
            ]
        }
        
        success, response = self.run_test(
            "Create Template",
            "POST",
            "api/templates",
            200,
            data=template_data
        )
        
        if success and 'id' in response:
            self.template_id = response['id']
            print(f"   Created template ID: {self.template_id}")
        
        return success

    def test_get_templates(self):
        """Test getting all templates"""
        success, response = self.run_test(
            "Get All Templates",
            "GET",
            "api/templates",
            200
        )
        
        if success:
            print(f"   Found {len(response)} templates")
        
        return success

    def test_get_template_by_id(self):
        """Test getting specific template"""
        if not self.template_id:
            print("❌ No template ID available for testing")
            return False
            
        success, response = self.run_test(
            "Get Template by ID",
            "GET",
            f"api/templates/{self.template_id}",
            200
        )
        
        if success:
            print(f"   Retrieved template: {response.get('name', 'Unknown')}")
        
        return success

    def test_update_template(self):
        """Test updating template"""
        if not self.template_id:
            print("❌ No template ID available for testing")
            return False
            
        update_data = {
            "name": "Updated Test Template",
            "description": "Updated description"
        }
        
        success, response = self.run_test(
            "Update Template",
            "PUT",
            f"api/templates/{self.template_id}",
            200,
            data=update_data
        )
        
        return success

    def test_upload_data_file(self):
        """Test file upload for data integration"""
        # Create a simple CSV file in memory
        csv_content = "name,age,city\nJohn,25,New York\nJane,30,Los Angeles\nBob,35,Chicago"
        csv_file = io.BytesIO(csv_content.encode())
        
        files = {'file': ('test_data.csv', csv_file, 'text/csv')}
        
        success, response = self.run_test(
            "Upload CSV Data File",
            "POST",
            "api/datasources/upload",
            200,
            files=files
        )
        
        if success and 'id' in response:
            self.datasource_id = response['id']
            print(f"   Created datasource ID: {self.datasource_id}")
            print(f"   Rows: {response.get('rowCount', 0)}, Columns: {len(response.get('columns', []))}")
        
        return success

    def test_get_datasources(self):
        """Test getting all data sources"""
        success, response = self.run_test(
            "Get All Data Sources",
            "GET",
            "api/datasources",
            200
        )
        
        if success:
            print(f"   Found {len(response)} data sources")
        
        return success

    def test_export_template(self):
        """Test template export"""
        if not self.template_id:
            print("❌ No template ID available for testing")
            return False
            
        export_data = {
            "templateId": self.template_id,
            "format": "png",
            "dataSourceId": self.datasource_id if self.datasource_id else None
        }
        
        success, response = self.run_test(
            "Export Template",
            "POST",
            "api/export",
            200,
            data=export_data
        )
        
        if success:
            print(f"   Export data rows: {len(response.get('dataRows', []))}")
        
        return success

    def test_api_data_fetch(self):
        """Test API data fetching"""
        api_config = {
            "url": "https://jsonplaceholder.typicode.com/users",
            "method": "GET",
            "headers": {}
        }
        
        success, response = self.run_test(
            "Fetch API Data",
            "POST",
            "api/datasources/api",
            200,
            data=api_config
        )
        
        if success:
            print(f"   API data rows: {response.get('rowCount', 0)}")
        
        return success

    def test_template_history(self):
        """Test template history functionality"""
        if not self.template_id:
            print("❌ No template ID available for testing")
            return False
            
        # Save a history entry
        history_data = {
            "templateId": self.template_id,
            "action": "Element Added",
            "snapshot": {"elements": [], "settings": {}}
        }
        
        success, response = self.run_test(
            "Save History Entry",
            "POST",
            f"api/history?templateId={self.template_id}&action=Element Added",
            200,
            data=history_data.get('snapshot')
        )
        
        if not success:
            return False
            
        # Get history
        success, response = self.run_test(
            "Get Template History",
            "GET",
            f"api/history/{self.template_id}",
            200
        )
        
        return success

    def test_template_download(self):
        """Test template download"""
        if not self.template_id:
            print("❌ No template ID available for testing")
            return False
            
        success, response = self.run_test(
            "Download Template",
            "GET",
            f"api/templates/{self.template_id}/download",
            200
        )
        
        return success

    def cleanup_test_data(self):
        """Clean up test data"""
        print("\n🧹 Cleaning up test data...")
        
        # Delete template
        if self.template_id:
            success, _ = self.run_test(
                "Delete Test Template",
                "DELETE",
                f"api/templates/{self.template_id}",
                200
            )
            
        # Delete datasource
        if self.datasource_id:
            success, _ = self.run_test(
                "Delete Test DataSource",
                "DELETE",
                f"api/datasources/{self.datasource_id}",
                200
            )

def main():
    print("🚀 Starting Template Editor API Tests")
    print("=" * 50)
    
    tester = TemplateEditorAPITester()
    
    # Core API tests
    tests = [
        tester.test_root_endpoint,
        tester.test_create_template,
        tester.test_get_templates,
        tester.test_get_template_by_id,
        tester.test_update_template,
        tester.test_upload_data_file,
        tester.test_get_datasources,
        tester.test_api_data_fetch,
        tester.test_export_template,
        tester.test_template_history,
        tester.test_template_download,
    ]
    
    # Run all tests
    for test in tests:
        try:
            test()
        except Exception as e:
            print(f"❌ Test failed with exception: {e}")
            tester.tests_run += 1
    
    # Cleanup
    tester.cleanup_test_data()
    
    # Print results
    print("\n" + "=" * 50)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print(f"⚠️  {tester.tests_run - tester.tests_passed} tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())