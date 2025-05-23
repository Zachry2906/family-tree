// JWT Authentication Variables
const BASE_URL = 'http://localhost:3000'; // Sesuaikan dengan URL backend Anda
let token = "";
let expire = "";
let name = "";
let id = "";

// Function untuk decode JWT (tanpa library)
function decodeJWT(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error("Error decoding JWT:", e);
    return null;
  }
}

// Function untuk memperbarui informasi user dari token
function updateUserFromToken() {
  token = localStorage.getItem('token') || "";
  if (token) {
    try {
      const decoded = decodeJWT(token);
      expire = decoded.exp;
      name = decoded.name;
      id = decoded.id;
    } catch (e) {
      token = "";
      expire = "";
      name = "";
      id = "";
    }
  } else {
    console.log("Tokedcdcdc");
  }
}

// Initialize user info from token saat halaman dimuat
updateUserFromToken();

// Function untuk memeriksa dan memperbarui token jika diperlukan
async function checkAndRefreshToken() {
  const currentDate = new Date();
  console.log("Current Date:", currentDate);
  
  // Cek apakah token sudah expire
  if (!token || expire * 1000 < currentDate.getTime()) {
    try {
      // Request token baru
      const response = await $.ajax({
        url: `${BASE_URL}/api/token`,
        type: 'GET',
        xhrFields: {
          withCredentials: true // Ini penting untuk mengirim cookies
        }
      });
      
      console.log("Token refreshed:", response);
      
      // Update token
      token = response.accessToken;
      localStorage.setItem('token', token);
      
      // Decode token baru
      const decoded = decodeJWT(token);
      expire = decoded.exp;
      name = decoded.name;
      id = decoded.id;
      
      return token;
    } catch (err) {
      console.error("Error refreshing token:", err);
      alert("Session expired, please login again");
      // Redirect ke halaman login
      window.location.href = '/login';
      throw err;
    }
  }
  return token;
}

// Get token synchronously (use existing value or from localStorage)
function getToken() {
  if (!token) {
    updateUserFromToken();
  }
  return token;
}

// Preload token before any AJAX calls
(async function() {
  try {
    await checkAndRefreshToken();
  } catch (err) {
    console.error("Failed to preload token:", err);
  }
})();

// Setup jQuery AJAX untuk selalu menggunakan token
$.ajaxSetup({
  beforeSend: function(xhr, settings) {
    // Skip untuk beberapa jenis request yang tidak perlu token
    if (settings.url === `${BASE_URL}/api/token` || settings.url.indexOf('/login') > -1) {
      return;
    }
    
    // Use token synchronously - no async/await here
    const currentToken = getToken();
    if (currentToken) {
      console.log("Setting Authorization header with token:", currentToken);
      xhr.setRequestHeader('Authorization', `Bearer ${currentToken}`);
    }
  },
  // Ensure we're sending credentials (cookies) with cross-domain requests
  xhrFields: {
    withCredentials: true
  },
  complete: function(xhr) {
    // Log headers sent for debugging
    console.log("Request headers sent:", xhr.getAllResponseHeaders());
  }
});

// Make sure we refresh token before important operations
async function ensureValidToken() {
  try {
    await checkAndRefreshToken();
    return true;
  } catch (error) {
    console.error("Failed to ensure valid token:", error);
    return false;
  }
}

// Inisialisasi Family Tree
var options = getOptions();

// Make sure we have valid token before loading tree
(async function() {
  await ensureValidToken();
  loadFamilyTree();
})();

// Define node menu template
var nodeMenu = {
    edit: { text: 'Edit' },
    details: { text: 'Details' },
    delete: { text: 'Delete', icon: '✕', onClick: deleteNode }
};

// Chart configuration
var chart = new FamilyTree(document.getElementById('tree'), {
    showXScroll: FamilyTree.scroll.visible,
    showYScroll: FamilyTree.scroll.visible,
    mouseScrool: FamilyTree.action.zoom,
    scaleInitial: options.scaleInitial,
    mode: 'dark',
    template: 'john',
    roots: [3],
    nodeMenu: nodeMenu,
    nodeTreeMenu: true,
    nodeBinding: {
        field_0: 'name',
        field_1: 'born',
        img_0: 'photo'
    },
    editForm: {
        titleBinding: "name",
        photoBinding: "photo",
        elements: [
            { type: 'textbox', label: 'Full Name', binding: 'name' },
            { type: 'textbox', label: 'Email Address', binding: 'email' },
            [
                { type: 'textbox', label: 'Phone', binding: 'phone' },
                { type: 'date', label: 'Date Of Birth', binding: 'born' }
            ],
            [
                { type: 'textbox', label: 'City', binding: 'city' },
            ],
            { type: 'textbox', label: 'Photo Url', binding: 'photo', btn: 'Upload' },
        ]
    }
});


    $("#logout").click(function (e) {
      e.preventDefault();
      $.ajax({
        url: `${BASE_URL}/api/logout`,
        method: "DELETE",
        contentType: "application/json",
        success: function () {
          window.location.href = "index.html"; // Redirect ke halaman tree
        },
        error: function (xhr) {
          if (xhr.responseJSON && xhr.responseJSON.message) {
            $("#msg").text(xhr.responseJSON.message);
          } else {
            $("#msg").text("Logout failed. Please try again.");
          }
        }
      });
    });

// Format birth date
chart.on('field', function (sender, args) {
    if (args.name == 'born') {
        var date = new Date(args.value);
        args.value = date.toLocaleDateString();
    }
});

// Photo upload handler
chart.editUI.on('element-btn-click', function(sender, args) {
    // Create file input element
    var fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);

    // Trigger click event to open file selection dialog
    fileInput.click();

    // Handle when file is selected
    fileInput.onchange = function(e) {
        var file = e.target.files[0];
        if (!file) return;

        // Create form data for upload
        var formData = new FormData();
        formData.append('photo', file);

        // Upload photo to server endpoint
        $.ajax({
            url: '/api/upload-photo',
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            success: function(response) {
                console.log('Photo uploaded:', response);

                // Update photo field value with newly uploaded photo URL
                var photoInput = document.querySelector('[data-binding="photo"]');
                if (photoInput) {
                    photoInput.value = response.photoUrl;

                    // Trigger change event to ensure the familytree library detects the change
                    var changeEvent = new Event('change');
                    photoInput.dispatchEvent(changeEvent);

                    // Update preview if it exists
                    var photoPreview = photoInput.parentNode.querySelector('img') ||
                        photoInput.parentNode.querySelector('.photo-preview img');
                    if (photoPreview) {
                        photoPreview.src = '/view/assets/' + response.photoUrl;
                    } else {
                        // Create preview if it doesn't exist
                        var preview = document.createElement('div');
                        preview.className = 'photo-preview';
                        preview.style.marginTop = '10px';

                        var img = document.createElement('img');
                        img.src = '/view/assets/' + response.photoUrl;
                        img.style.maxWidth = '100px';
                        img.style.maxHeight = '100px';

                        preview.appendChild(img);
                        photoInput.parentNode.appendChild(preview);
                    }
                }
            },
            error: function(xhr, status, error) {
                console.error('Error uploading photo:', error);
                alert('Failed to upload photo. Please try again.');
            }
        });
        // Remove file input after use
        document.body.removeChild(fileInput);
    };
});

// Event handler to add first node when chart is empty
chart.on('add', function (sender, node) {
    if (chart.nodes.length >= 1) return; // If there are other nodes, skip
    // If chart is empty, add new node
    addNewNode();
    return false;
});

// Function to add new node when chart is empty
function addNewNode() {
    var node = { id: 1, name: "Nama anda", gender: "male" };

    ensureValidToken().then(() => {
        $.ajax({
            url: '/api/family',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(node),
            success: function(newPerson) {
                console.log('Family member added:', newPerson);
                loadFamilyTree(function() {
                    // Highlight or focus on the new node if needed
                    if (newPerson && newPerson.data && newPerson.data.id) {
                        chart.center(newPerson.data.id);
                    }
                });
            },
            error: function(xhr, status, error) {
                console.error('Error adding family member:', error);
            }
        });
    });
}

// Handler for node updates
chart.onUpdateNode(function (args) {
    let promises = [];

    // Add new data (POST)
    if (args.addNodesData.length) {
        args.addNodesData.forEach(function(person) {
            // Don't send null for fid/mid if they don't exist
            if (!person.fid) delete person.fid;
            if (!person.mid) delete person.mid;
            console.log('Adding node:', person);

            // Add family member to database and track the promise
            let promise = new Promise((resolve, reject) => {
                $.ajax({
                    url: '/api/family',
                    type: 'POST',
                    contentType: 'application/json',
                    data: JSON.stringify(person),
                    success: function(newPerson) {
                        console.log('Family member added:', newPerson);
                        resolve(newPerson);
                    },
                    error: function(xhr, status, error) {
                        console.error('Error adding family member:', error);
                        reject(error);
                    }
                });
            });

            promises.push(promise);
        });
    }

    // Update data (PUT)
    if (args.updateNodesData.length) {
        args.updateNodesData.forEach(function(person) {
            console.log('Updating node:', person);

            let promise = new Promise((resolve, reject) => {
                $.ajax({
                    url: `/api/family/${person.id}`,
                    type: 'PUT',
                    contentType: 'application/json',
                    data: JSON.stringify(person),
                    success: function(updatedPerson) {
                        console.log('Family member updated:', updatedPerson);
                        resolve(updatedPerson);
                    },
                    error: function(xhr, status, error) {
                        console.error('Error updating family member:', error);
                        reject(error);
                    }
                });
            });

            promises.push(promise);
        });
    }

    // Wait for all operations to complete before reloading the tree
    Promise.all(promises)
        .then(() => {
            console.log('All node operations completed, reloading family tree');
            loadFamilyTree();
        })
        .catch(error => {
            console.error('Error during node operations:', error);
            loadFamilyTree(); // Still try to reload even if there were errors
        });
});

// Delete node from chart and database
function deleteNode(nodeId) {
    console.log('Delete node:', nodeId);
    if (confirm('Are you sure you want to delete this family member?')) {
        ensureValidToken().then(() => {
            $.ajax({
                url: `/api/family/${nodeId}`,
                type: 'DELETE',
                success: function(response) {
                    console.log('Family member deleted from database:', response);
                    // Remove node from chart
                    chart.removeNode(nodeId);
                    // Reload tree to ensure all relationships are updated
                    loadFamilyTree();
                },
                error: function(xhr, status, error) {
                    console.error('Error deleting family member:', error);
                }
            });
        });
    }
}

// Load family data from API and load into chart
function loadFamilyTree(callback) {
    console.log('Loading family tree');
    
    // First ensure we have valid token
    ensureValidToken().then(() => {
        $.ajax({
            url: '/api/family',
            type: 'GET',
            success: function(data) {
                // Check if data is valid before loading
                if (Array.isArray(data)) {
                    chart.load(data);
                    console.log('Family tree loaded with', data.length, 'members');

                    // Execute callback if provided
                    if (typeof callback === 'function') {
                        callback();
                    }
                } else {
                    console.error('Invalid data format received:', data);
                }
            },
            error: function(xhr, status, error) {
                console.error('Error loading family data:', error);
            }
        });
    });
}

// Get options from URL parameters
function getOptions() {
    const searchParams = new URLSearchParams(window.location.search);
    var fit = searchParams.get('fit');
    var enableSearch = true;
    var scaleInitial = 1;
    if (fit == 'yes') {
        enableSearch = false;
        scaleInitial = FamilyTree.match.boundary;
    }
    return {enableSearch, scaleInitial};
}