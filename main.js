"use strict";

const body = document.body,
    form = document.querySelector('form'),
    svgLabel = form.svg.parentNode,
    previewer = svgLabel.querySelector('img');

let initTime;
let bgVal;
    
form.svg.onchange = function(event) {
    const [file] = form.svg.files;
    previewer.src = URL.createObjectURL(file);
    svgLabel.className = 'choosen';
    // TODO: read the canvas sources
    // TODO: get the canvas width and height to set the attributes in the in the SVG node (see https://stackoverflow.com/a/28692538)
    // TODO: get the animation duration
}

previewer.onload = function() {
    form.width.placeholder = previewer.naturalWidth;
    form.height.placeholder = previewer.naturalHeight;
}

form.onsubmit = function (event) {
    // validate form
    const errors = validateForm();
    if (errors.length)
        console.error(errors);
    if (!errors.length) {
        /**
         * @type {File}
         */
        const file = form.svg.files[0];
        // start record
        startRecord({
            url: URL.createObjectURL(file),
            width: parseInt(form.width.value || form.width.placeholder),
            height: parseInt(form.height.value || form.height.placeholder),
            duration: parseInt(form.duration.value || form.duration.placeholder),
            framerate: parseInt(form.framerate.value || form.framerate.placeholder),
            background: bgVal
        }).then(function(blob) {
            const generatedFile = new File([new Blob([blob], {type: 'application/octet-stream'})], file.name.replace(/\.svgz?$/i, '.webm'));
            const a = document.createElement('a');
            a.download = generatedFile.name;
            a.href = URL.createObjectURL(generatedFile);
            a.dataset.downloadurl = [generatedFile.type, a.download, a.href].join(':');
            const mouseEvent = document.createEvent('MouseEvents');
            mouseEvent.initMouseEvent('click', true, false, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
            a.dispatchEvent(mouseEvent);
        });
    }

    // prevent form submit
    event.preventDefault();
    event.stopPropagation();
    return;
}

form.width.onchange = form.height.onchange = function(e) {
    const current = e.currentTarget;
    if (form["link-dimensions"].checked) {
        const other = current==form.width ? form.height : form.width;
        const ratio = parseInt(current.value) / parseInt(current.previousValue || current.placeholder);
        other.value = Math.round(parseInt(other.value || other.placeholder) * ratio);
    }
    storeValue(current);
}

form.width.onfocus = form.height.onfocus = function(e) {
    storeValue(e.currentTarget);
}

form.backgroundEn.onclick = function(e) {
    if(form.backgroundEn.checked){
        form.background.disabled=false

    }else{
        form.background.disabled=true

    }
}

/**
 * @param {HTMLInputElement} input
 */
function storeValue(input) {
    input.previousValue = input.value;
}

/**
 * Validate the form
 * @returns Validation errors
 */
function validateForm() {
    const errors = [];
    // check file selected
    if (!form.svg.files.length)
        errors.push({
            field: 'svg',
            message: 'No file selected'
        });
    // check width and height
    if (form.width.value && !checkPositifInt(form.width.value))
        errors.push({
            field: 'width',
            message: 'The width is not a valid number'
        });
    if (form.height.value && !checkPositifInt(form.height.value))
        errors.push({
            field: 'height',
            message: 'The height is not a valid number'
        });
    // check duration
    if (form.duration.value && !checkPositifInt(form.duration.value))
        errors.push({
            field: 'duration',
            message: 'The duration is not a valid number'
        });
    // check framerate
    if (form.framerate.value && !checkPositifInt(form.framerate.value))
        errors.push({
            field: 'framerate',
            message: 'The framerate is not a valid number'
        });
    // check background
    if (form["backgroundEn"].checked){
        if (!form.background.value){
            errors.push({
                field: 'background',
                message: 'The background color must be defined'
            });
        }else if (!/^#[a-fA-F0-9]{6}$/.test(form.background.value)){
            errors.push({
                field: 'background',
                message: `The background value is not a valid color: ${form.background.value}`
            });
        }else{
            bgVal=form.background.value
        }
    }else{
        bgVal=null
    }
    return errors;
}

/**
 * Check if the given string is a valid integer over zero
 * @param {string} val The string to check
 * @returns true if it's a valid number
 */
function checkPositifInt(val) {
    return /^[1-9]\d*$/.test(val);
}

/**
 * Start recording with the given options
 * @param {any} options Recording options
 * @returns {Promise<Blob>} The recoreded video blob
 */
function startRecord(options) {
    return new Promise(function(resolve, reject) {
        console.log('startRecord', options);
        if (body.className) 
            return reject(new Error("It's already recording"));
        
        body.className = 'recording';
        // create image, canvas and recorder
        const image = document.createElement('img'),
            canvas = document.createElement('canvas'),
            ctx = canvas.getContext('2d'),
            chunks = [],
            stream = canvas.captureStream(options.framerate),
            recorder = new MediaRecorder(stream, { mimeType: "video/webm" });

        initTime = null;

        canvas.width = image.width = options.width;
        canvas.height = image.height = options.height;
        if(options.background != null){
            ctx.fillStyle = options.background;
        }

        body.appendChild(image);
        body.appendChild(canvas);

        recorder.ondataavailable = function(event) {
            const blob = event.data;
            if (blob && blob.size) { 
                chunks.push(blob); 
            }
        };

        recorder.onstop = function(event) {
            // remove temp components
            body.removeChild(image);
            body.removeChild(canvas);

            body.className = '';

            resolve(new Blob(chunks, { type: "video/webm" }));
        };

        // on image loaded start recording
        image.onload = function(event) {
            // Start recording
            renderLoop();
        }
        image.src = options.url;

        /**
         * Loop rendering the canvas
         * @param {number} time The loop time
         */
        function renderLoop(time) {
            render();
            if (initTime==null) {
                // First call
                if (!time)
                    recorder.start();
                else
                    initTime = time; 
            }
            else if (time - initTime > options.duration) {
                // stop recording after defined duration
                recorder.stop();
                return;
            }
            requestAnimationFrame(renderLoop);
        }

        /**
         * Render the canvas with the given background and SVG
         */
        function render() {
            ctx.rect(0, 0, options.width, options.height);
            if(options.background == null){
                ctx.clearRect(0, 0, options.width, options.height);
            }else{
                ctx.fill();
            }

            ctx.drawImage(image, 0, 0, options.width, options.height);
        }
    });
}
