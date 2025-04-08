var options = getOptions();
getFamilly();

// buat template untuk node
var nodeMenu = {
    edit: { text: 'Edit' },
    details: { text: 'Details' },
    delete: { text: 'Delete', icon: '✕', onClick: deleteNode }
};

// konfigurasi chart
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

// format tanggal lahir
chart.on('field', function (sender, args) {
    if (args.name == 'born') {
        var date = new Date(args.value);
        args.value = date.toLocaleDateString();
    }
});

// handler untuk upload foto
chart.editUI.on('element-btn-click', function(sender, args) {
    // buat input file element
    var fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);
    
    // trigger click event untuk membuka dialog pemilihan file
    fileInput.click();
    
    // handle saat file dipilih
    fileInput.onchange = function(e) {
        var file = e.target.files[0];
        if (!file) return;
        
        // membuat form data untuk upload
        var formData = new FormData();
        formData.append('photo', file);
        
        // upload foto ke endpoint server
        $.ajax({
            url: '/api/upload-photo',
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            success: function(response) {
                console.log('foto terupload:', response);
                
                // perbarui nilai field photo dengan url foto yang baru diupload
                var photoInput = document.querySelector('[data-binding="photo"]');
                if (photoInput) {
                    photoInput.value = response.photoUrl;
                    
                    // trigger event change untuk memastikan library familytree mengetahui perubahan
                    var changeEvent = new Event('change');
                    photoInput.dispatchEvent(changeEvent);
                    
                    // update preview jika ada
                    var photoPreview = photoInput.parentNode.querySelector('img') || 
                                      photoInput.parentNode.querySelector('.photo-preview img');
                    if (photoPreview) {
                        photoPreview.src = '/view/assets/' + response.photoUrl;
                    } else {
                        // buat preview jika belum ada
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
                console.error('error upload foto:', error);
                alert('gagal upload foto. silakan coba lagi.');
            }
        });
        // hapus input file setelah digunakan
        document.body.removeChild(fileInput);
    };
});

// event handler untuk menambahkan node pertama ketika chart kosong
chart.on('add', function (sender, node) {
    if (chart.nodes.length >= 1) return; // jika sudah ada node lain, lewati
    // jika chart kosong, tambahkan node baru
    addNewNode();
    return false;
});

// fungsi untuk menambahkan node baru ketika chart kosong
function addNewNode() {
    var node = { id: 1, name: "Nama anda", gender: "male" };
    chart.addNode(node);

    $.ajax({
        url: '/api/family',
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify(node),
        success: function(newPerson) {
            console.log('anggota keluarga ditambahkan:', newPerson);
            getFamilly();
        },
        error: function(xhr, status, error) {
            console.error('error menambahkan anggota keluarga:', error);
        }
    });
}

// handler untuk update node
chart.onUpdateNode(function (args) {
    let spouseId;
    // tambah data baru (POST)
    if (args.addNodesData.length) {
        $.each(args.addNodesData, function(index, person) {
            // jangan kirim null untuk fid/mid jika tidak ada
            if (!person.fid) delete person.fid;
            if (!person.mid) delete person.mid;
            console.log('tambah node:', person);
            
            // cek apakah ada pasangan yang sudah ada
            const isSpouse = person.pids && person.pids.length > 0;
            spouseId = isSpouse ? person.pids[0] : null;

            console.log('id pasangan:', spouseId);
            console.log('adalah pasangan:', isSpouse);
            
            // tambah anggota keluarga ke database
            $.ajax({
                url: '/api/family',
                type: 'POST',
                contentType: 'application/json',
                data: JSON.stringify(person),
                success: function(newPerson) {
                    console.log('anggota keluarga ditambahkan:', newPerson);
                    if (newPerson.data.id && spouseId) {
                        console.log(`update id sementara ${newPerson.data.id} ke id database ${spouseId}`);
                        createRelationship(newPerson.data.id, spouseId, 'spouse');
                    }
                    getFamilly();
                },
                error: function(xhr, status, error) {
                    console.error('error menambahkan anggota keluarga:', error);
                }
            });
        });
    }
    
    // update data (PUT)
    if (args.updateNodesData.length) {
        $.each(args.updateNodesData, function(index, person) {
            console.log('update node:', person);
            $.ajax({
                url: `/api/family/${person.id}`,
                type: 'PUT',
                contentType: 'application/json',
                data: JSON.stringify(person),
                success: function() {
                    console.log('anggota keluarga diperbarui!');
                },
                error: function(xhr, status, error) {
                    console.error('error memperbarui anggota keluarga:', error);
                }
            });
            
            // cek apakah ada pasangan yang sudah ada
            if (person.pids && person.pids.length > 0) {
                $.each(person.pids, function(index, spouseId) {
                    // cek apakah hubungan sudah ada sebelumnya
                    console.log('memeriksa hubungan untuk id pasangan:', spouseId);
                    checkExistingRelationship(person.id, spouseId, 'spouse');
                });
            }
            getFamilly();
        });
    }
});

// membuat hubungan baru antara dua orang
function createRelationship(personId, relatedPersonId, relationshipType) {
    // pastikan keduanya adalah id database yang valid
    if (isNaN(personId) || isNaN(relatedPersonId)) {
        console.error('id tidak valid untuk hubungan:', personId, relatedPersonId);
        return;
    }
    
    $.ajax({
        url: '/api/relationship',
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({
            person_id: personId,
            related_person_id: relatedPersonId,
            relationship_type: 'spouse'
        }),
        success: function(data) {
            console.log('hubungan dibuat:', data);
            
            // jika ini adalah hubungan pasangan, perbarui data anak-anak
            if (relationshipType === 'spouse') {
                // cek gender dari kedua orang untuk menentukan siapa ayah dan siapa ibu
                $.ajax({
                    url: `/api/family/${personId}`,
                    type: 'GET',
                    success: function(person1) {
                        $.ajax({
                            url: `/api/family/${relatedPersonId}`,
                            type: 'GET',
                            success: function(person2) {
                                // identifikasi ayah dan ibu berdasarkan gender
                                let fatherId, motherId;
                                
                                if (person1.gender === 'male' && person2.gender === 'female') {
                                    fatherId = personId;
                                    motherId = relatedPersonId;
                                } else if (person1.gender === 'female' && person2.gender === 'male') {
                                    fatherId = relatedPersonId;
                                    motherId = personId;
                                }
                                
                                // jika ayah dan ibu berhasil diidentifikasi, update anak-anak
                                if (fatherId && motherId) {
                                    updateChildrenMother(fatherId, motherId);
                                    getFamilly();
                                }
                            }
                        });
                    }
                });
            }
        },
        error: function(xhr, status, error) {
            console.error('error membuat hubungan:', error);
        }
    });
}

// memeriksa apakah hubungan sudah ada sebelum membuat yang baru
function checkExistingRelationship(personId, relatedPersonId, relationshipType) {
    $.ajax({
        url: `/api/relationships?person_id=${personId}&related_person_id=${relatedPersonId}`,
        type: 'GET',
        success: function(data) {
            if (data.length === 0) {
                // jika tidak ada hubungan yang ditemukan, buat hubungan baru
                createRelationship(personId, relatedPersonId, relationshipType);
            }
        },
        error: function(xhr, status, error) {
            console.error('error memeriksa hubungan:', error);
        }
    });
}

// menghapus node dari chart dan database
function deleteNode(nodeId) {
    console.log('hapus node:', nodeId);
    if (confirm('apakah anda yakin ingin menghapus anggota keluarga ini?')) {
        // pertama, hapus node dari database
        $.ajax({
            url: `/api/family/${nodeId}`,
            type: 'DELETE',
            success: function() {
                console.log('anggota keluarga dihapus dari database!');
                // hapus node dari chart setelah berhasil dihapus dari database
                chart.removeNode(nodeId);
                getFamilly();
            },
            error: function(xhr, status, error) {
                console.error('error menghapus anggota keluarga:', error);
            }
        });
    }
}

// menambahkan tombol hapus ke setiap node
function addDeleteButtons() {
    // ambil semua node
    $('[data-n-id]').each(function() {
        var node = $(this);
        var nodeId = node.attr('data-n-id');
        
        // periksa apakah node ini sudah memiliki tombol hapus
        if (node.find('.delete-btn-' + nodeId).length) {
            return; // lewati jika tombol sudah ada
        }
        
        // buat tombol hapus
        var foreignObject = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
        $(foreignObject).attr({
            'width': '30',
            'height': '30',
            'x': '5',
            'y': '90'
        }).addClass('delete-btn-' + nodeId);
        
        var button = $('<button></button>').html('✕').css({
            'backgroundColor': '#FFFFFF',
            'color': 'black',
            'border': 'none',
            'borderRadius': '50%',
            'width': '25px',
            'height': '25px',
            'fontSize': '14px',
            'cursor': 'pointer',
            'display': 'flex',
            'alignItems': 'center',
            'justifyContent': 'center',
            'padding': '0'
        }).on('click', function(e) {
            e.stopPropagation(); // mencegah seleksi node
            deleteNode(nodeId);
        });
        
        $(foreignObject).append(button);
        node.append(foreignObject);
    });
}

// mengambil data keluarga dari api dan memuat ke chart
function getFamilly() {
    $.ajax({
        url: '/api/family',
        type: 'GET',
        success: function(data) {
            chart.load(data);
        },
        error: function(xhr, status, error) {
            console.error('error:', error);
        }
    });
}

// mendapatkan opsi dari parameter url
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

// fungsi untuk update mid anak-anak setelah menambahkan istri
function updateChildrenMother(fatherId, motherId) {
    // ambil semua data family untuk mencari anak-anak
    $.ajax({
        url: '/api/family',
        type: 'GET',
        success: function(data) {
            // filter untuk menemukan semua anak dengan fid yang sesuai
            const children = data.filter(person => person.fid == fatherId);
            
            console.log(`ditemukan ${children.length} anak untuk ayah dengan id ${fatherId}`);
            console.log('id ibu:', motherId);
            
            // update mid untuk setiap anak
            $.each(children, function(index, child) {
                console.log("data anak:", child);
                
                // jika mid kosong atau null, update dengan motherId baru
                if (!child.mid || child.mid === 'null' || child.mid === null) {
                    console.log(`memperbarui mid untuk anak ${child.id} (${child.name}) dari ${child.mid} ke ${motherId}`);
                    
                    // update di database
                    $.ajax({
                        url: `/api/family/${child.id}`,
                        type: 'PUT',
                        contentType: 'application/json',
                        data: JSON.stringify({
                            ...child,
                            mid: motherId
                        }),
                        success: function() {
                            console.log(`anak ${child.id} diperbarui dengan id ibu baru ${motherId}`);
                            
                            // update di chart juga
                            chart.updateNode({
                                id: child.id,
                                mid: motherId
                            });
                        },
                        error: function(xhr, status, error) {
                            console.error(`error memperbarui anak ${child.id}:`, error);
                        }
                    });
                }
            });
        },
        error: function(xhr, status, error) {
            console.error('error mengambil data keluarga:', error);
        }
    });
}