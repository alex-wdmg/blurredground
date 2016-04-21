/*

BlurredGround 0.2
Real time blurred background from full-height page canvas by @wdmg
https://github.com/wdmg/blurredground

Author: Alexsander Vyshyvetskyy
Contact: alex.vyshnyvetskyy@gmail.com
License: https://github.com/wdmg/blurredground/blob/master/LICENSE.md
Copyright (c) 2016 Alexsander Vyshyvetskyy (W.D.M.Group, Ukraine)

Require:
	https://github.com/jquery/jquery
	https://github.com/niklasvh/html2canvas

Blur commons:
	https://github.com/Quasimondo/QuasimondoJS/blob/master/blur/StackBlur.js
    https://github.com/epistemex/realtime-blur-js

*/

(function() {
	"use strict";
	var $, BlurredGround;
	$ = jQuery;

	BlurredGround = function(element, options) {
		var element, blurredCanvas, scrollOffset, canvasId, startTime;

		this.options = $.extend({
			localStorage: true,
			cacheTime: 86400,
			background: '#ffffff',
			processor: 'StackBlur',
			blurring: true,
			blurringRadius: 64,
			offsetX: 0,
			offsetY: 0,
			opacity: 1,
			compress: 1,
			lighten: 0.5,
			logging: false,
		}, $.fn.blurredGround.defaults, options || {});

		this.startTime = Date.now()
		this.element = element;
		this.$element = $(element);

		if (typeof html2canvas !== "function") {
			console.warn('"Html2canvas" plugin is not found or was not init first!');
			return;
		}

		if (typeof stackBlurImage !== "function" && this.options.processor == 'StackBlur') {
			console.warn('"StackBlur" plugin is not found or was not init first!');
			return;
		} else if (typeof RTBlur !== "function" && this.options.processor == 'RTBlur') {
			console.warn('"RTBlur" plugin is not found or was not init first!');
			return;
		}

		return this.init();
	};

	BlurredGround.prototype = {
		log: function(msg) {
			var currentTime = parseInt(Date.now() - this.startTime);
			console.log(currentTime + 'ms BlurredGround: ' + msg);
		},
		getUrlHash: function(url) {
			return url.split("").reduce(function(a, b) {
				a = ((a << 5) - a) + b.charCodeAt(0);
				return a & a
			}, 0);
		},
		attachBackground: function(ocanvas) {
			this.setSourceCanvas(ocanvas);
			this.$element.css('background', this.options.background + ' url(' + this.blurredCanvas + ') center top no-repeat');
			this.$element.show();
			if (this.options.logging)
				this.log('Attach background to element.');

			$(this).data('canvas', this.blurredCanvas);
		},
		getSourceCanvas: function() {
			return this.blurredCanvas;
		},
		setSourceCanvas: function(ocanvas) {
			this.blurredCanvas = ocanvas;
			return this.blurredCanvas;
		},
		bindScrolling: function() {
			var $element = this.$element;
			$(window).scroll(function() {
				var position = -($(window).scrollTop());
				$element.css('background-position', 'center ' + position + 'px');
			});
		},
		getPageSizes: function() {
			var body = document.body
			var html = document.documentElement;
			var width = Math.max(body.scrollWidth, body.offsetWidth, html.clientWidth, html.scrollWidth, html.offsetWidth);
			var height = Math.max(body.scrollHeight, body.offsetHeight, html.clientHeight, html.scrollHeight, html.offsetHeight);

			if (this.options.logging)
				this.log('Get full-page sizes, width: ' + width + 'px, height: ' + height);

			return {
				width: width,
				height: height
			};
		},
		lightenBg: function(canvas, lighten) {
			if (lighten > 0 && canvas) {
				var ctx = canvas.getContext('2d');
				var idata = ctx.getImageData(0, 0, canvas.width, canvas.height);
				var data = idata.data;
				var len = data.length;
				var r, g, b;
				for (var i = 0; i < len; i += 4) {
					r = data[i];
					g = data[i + 1];
					b = data[i + 2];
					data[i] = r + r * (r / 255) * lighten;
					data[i + 1] = g + g * (g / 255) * lighten;
					data[i + 2] = b + b * (b / 255) * lighten;
				}
				ctx.putImageData(idata, 0, 0);
			}
			return canvas;
		},
		isLocalStorageSupport: function(testKey) {
			var _this = this;
			try {
				window.localStorage.setItem(testKey, '1');
				window.localStorage.removeItem(testKey);

				if (_this.options.logging)
					_this.log('Test `LocalStorage` is support!');

				return localStorageName in win && win[localStorageName];
			} catch (error) {

				if (_this.options.logging)
					_this.log('Test `LocalStorage` is not support!');

				_this.options.localStorage = false;
				return false;
			}
		},
		toLocalStorage: function(canvas) {
			if (this.isLocalStorageSupport(this.canvasId)) {
				var object = {
					value: canvas,
					timestamp: new Date().getTime()
				}
				window.localStorage.setItem(this.canvasId, JSON.stringify(object));
			}
		},
		getImageDataUri: function(src) {
			var _this = this;
			var image = new Image();
			image.src = src;
			/*image.setAttribute('crossOrigin', 'anonymous');*/
			image.onload = function() {
				if (_this.options.logging)
					_this.log('Converting "' + src + '" image src to data URI (Base64)');

				var canvas = document.createElement('canvas');
				canvas.width = this.naturalWidth;
				canvas.height = this.naturalHeight;
				canvas.getContext('2d').drawImage(this, 0, 0);
				return canvas.toDataURL('image/png');
			};
			return src;
		},
		compressCanvas: function(canvas) {
			var _this = this;
			if (_this.options.compress < 1) {
				if (_this.options.logging)
					_this.log('Compressing image with quality: ' + _this.options.compress);
				return canvas.toDataURL('image/jpeg', +_this.options.compress);
			} else {
				if (_this.options.logging)
					_this.log('Return image without compressing');
				return canvas.toDataURL('image/png');
			}
		},
		getCanvas: function(w, h) {
			var c = document.createElement('canvas');
			c.width = w;
			c.height = h;
			return c;
		},
		getPixels: function(canvas) {
			var _this = this;
			var c, ctx;
			if (canvas.getContext) {
				c = canvas;
				try {
					ctx = c.getContext('2d');
				} catch (e) {}
			}
			if (!ctx) {
				c = _this.getCanvas(canvas.width, canvas.height);
				ctx = c.getContext('2d');
				ctx.drawImage(canvas, 0, 0);
			}
			return ctx.getImageData(0, 0, c.width, c.height);
		},
		filterImage: function(filter, image, var_args) {
			var _this = this;
			var args = [_this.getPixels(image)];
			for (var i = 2; i < arguments.length; i++) {
				args.push(arguments[i]);
			}
			return filter.apply(null, args);
		},
		convolute: function(pixels, weights, opaque) {
			var _this = this;
			var side = Math.round(Math.sqrt(weights.length));
			var halfSide = Math.floor(side / 2);

			var src = pixels.data;
			var sw = pixels.width;
			var sh = pixels.height;

			var w = sw;
			var h = sh;
			var tmpCanvas = document.createElement('canvas');
			var tmpCtx = tmpCanvas.getContext('2d');
			var output = tmpCtx.createImageData(w, h);
			var dst = output.data;

			var alphaFac = opaque ? 1 : 0;

			for (var y = 0; y < h; y++) {
				for (var x = 0; x < w; x++) {
					var sy = y;
					var sx = x;
					var dstOff = (y * w + x) * 4;
					var r = 0,
						g = 0,
						b = 0,
						a = 0;
					for (var cy = 0; cy < side; cy++) {
						for (var cx = 0; cx < side; cx++) {
							var scy = Math.min(sh - 1, Math.max(0, sy + cy - halfSide));
							var scx = Math.min(sw - 1, Math.max(0, sx + cx - halfSide));
							var srcOff = (scy * sw + scx) * 4;
							var wt = weights[cy * side + cx];
							r += src[srcOff] * wt;
							g += src[srcOff + 1] * wt;
							b += src[srcOff + 2] * wt;
							a += src[srcOff + 3] * wt;
						}
					}
					dst[dstOff] = r;
					dst[dstOff + 1] = g;
					dst[dstOff + 2] = b;
					dst[dstOff + 3] = a + alphaFac * (255 - a);
				}
			}
			return output;
		},
		blurFilter: function(id, filter, args) {
			var c = document.getElementById(id);
			var idata = this.filterImage(filter, c, args);
			c.width = idata.width;
			c.height = idata.height;
			var ctx = c.getContext('2d');
			ctx.putImageData(idata, 0, 0);
			return c;
		},
		generateBackground: function() {
			$('body').scrollTop(0);

			var _this = this;
			if (this.options.logging)
				this.log('Generate full-page canvas (html2canvas)');

			this.options.before.call(this);

			var sizes = this.getPageSizes();
			var timeStart = new Date().getTime();
			var blurredGround = this;
			html2canvas($('body'), {
				onrendered: function(canvas) {

					var _this = blurredGround;
					var _sizes = sizes;

					if (_this.options.logging)
						_this.log('Create temporary canvas "#' + _this.canvasId + '".');

					var ocanvas = document.createElement('canvas');
					ocanvas.id = _this.canvasId;
					$('canvas#' + _this.canvasId).addClass('hide');
					document.body.appendChild(ocanvas);
					ocanvas.width = _sizes.width;
					ocanvas.height = _sizes.height;

					if (_this.options.logging)
						_this.log('Set canvas offset x: "' + _this.options.offsetX + '", y: "' + _this.options.offsetY + '".');


					ocanvas.style.left = _this.options.offsetX + 'px';
					ocanvas.style.top = _this.options.offsetY + 'px';

					var ctx = ocanvas.getContext('2d');
					ctx.imageSmoothingEnabled = false; /* ?? */

					if (_this.options.opacity > 0) {
						if (_this.options.logging)
							_this.log('Set opacity canvas with "' + _this.options.opacity + '" koef.');

						ctx.globalAlpha = _this.options.opacity;
					}

					ctx.drawImage(canvas, _this.options.offsetX, _this.options.offsetY, _sizes.width, _sizes.height, 0, 0, _sizes.width, _sizes.height);
					ctx.fillStyle = _this.options.background;

					if (_this.options.lighten > 0 && _this.options.lighten != false) {
						if (_this.options.logging)
							_this.log('Process lighten canvas with "' + _this.options.lighten + '" koef.');

						ocanvas = _this.lightenBg(ocanvas, _this.options.lighten);
					}

					if (_this.options.blurring && _this.options.blurringRadius > 0) {

						var isBlobData = false;

						if (_this.options.logging)
							_this.log('Process blurring canvas with "' + _this.options.blurringRadius + '" blurring radius.');

						if (_this.options.processor == 'StackBlur') {
							if (_this.options.logging)
								_this.log('Blurring processor selected has "stackBlurCanvas"');

							if (_this.options.opacity < 1)
								stackBlurCanvasRGBA(_this.canvasId, _this.options.offsetX, _this.options.offsetY, sizes.width, sizes.height, _this.options.blurringRadius);
							else
								stackBlurCanvasRGB(_this.canvasId, _this.options.offsetX, _this.options.offsetY, sizes.width, sizes.height, _this.options.blurringRadius);

						} else if (_this.options.processor == 'RTBlur') {
							if (_this.options.logging)
								_this.log('Blurring processor selected has "RTBlur"');

							var rtblur = new RTBlur({ // create a new RTBlur instance
								source: ocanvas, // source image, canvas or video
								quality: 4, // quality factor (default 3, range is [1, 5])
								HQ: true // optional High-Quality mode (default false)
							});

							var depth = _this.options.blurringRadius * 5.5;
							if (rtblur !== null) {
								rtblur.blur(depth, ctx);
							}
						} else {
							isBlobData = true;
							if (_this.options.logging)
								_this.log('No blurring processor selected. Use native box blur.');

							var data = '<svg xmlns="http://www.w3.org/2000/svg" width="' + canvas.width + '" height="' + canvas.height + '">' +
								'<foreignObject width="100%" height="100%">' +
								'<div xmlns="http://www.w3.org/1999/xhtml">' +
								'<img src="' + canvas.toDataURL('image/png') + '" style="display:block;-webkit-filter:blur(' + (_this.options.blurringRadius) + 'px);filter:blur(' + (_this.options.blurringRadius) + 'px);" width="' + canvas.width + '" height="' + canvas.height + '" />' +
								'</div>' +
								'</foreignObject>' +
								'</svg>';
							var DOMURL = window.URL || window.webkitURL || window;
							var img = new Image();
							var svg = new Blob([data], {
								type: 'image/svg+xml;charset=utf-8'
							});
							var url = DOMURL.createObjectURL(svg);
							img.onload = function() {
								DOMURL.revokeObjectURL(url);
							}
							img.src = url;

							if (_this.options.logging)
								_this.log('Converting `blob` data to `base64`');

							var xhr = new XMLHttpRequest();
							xhr.responseType = 'blob';
							xhr.onload = function() {
								var reader = new FileReader();
								reader.onloadend = function() {
									_this.blurredCanvas = reader.result;

									if (_this.options.localStorage)
										_this.toLocalStorage(_this.blurredCanvas);

									if (_this.options.logging)
										_this.log('Canvas `base64` data length: ' + _this.blurredCanvas.length);

								}
								reader.readAsDataURL(xhr.response);
							};
							xhr.open('GET', url);
							xhr.send(null);
							_this.blurredCanvas = img.src;
						}
					}

					if (!isBlobData) {
						_this.blurredCanvas = _this.compressCanvas(ocanvas);

						if (_this.options.logging)
							_this.log('Canvas `base64` data length: ' + _this.blurredCanvas.length);

						if (_this.options.localStorage)
							_this.toLocalStorage(_this.blurredCanvas);

					}

					_this.attachBackground(_this.blurredCanvas);
					_this.bindScrolling();

					if (_this.options.logging)
						_this.log('Remove temporary canvas "#' + _this.canvasId + '" from document.');

					$('canvas#' + _this.canvasId).remove();

					_this.options.after.call(this);

					var timeNow = new Date().getTime();
					if (_this.options.logging)
						_this.log('Generation complete, it took time: ' + ((timeNow - timeStart) / 1000) + ' sec.');

				},
				background: this.options.background,
				useBounds: false,
				letterRendering: true,
				useCORS: true,
				width: sizes.width,
				height: sizes.height,
				logging: (this.options.logging) ? true : false
			});
			return this;
		},
		init: function() {
			this.$element.css('background', this.options.background);
			var documentUrlHash = this.getUrlHash(document.location.href);

			if (this.options.logging)
				this.log('Current location href hash: ' + documentUrlHash);

			if (this.options.localStorage && typeof(Storage) !== "undefined") {
				if (this.options.logging)
					this.log('Web local storage support!');

				this.canvasId = "ocanvas" + documentUrlHash;
				if (this.options.logging)
					this.log('Page canvas indefier in localStorage: ' + this.canvasId);

				var object = JSON.parse(window.localStorage.getItem(this.canvasId));
				var timestamp, now = new Date().getTime();

				if (!$.isEmptyObject(object)) {
					timestamp = object.timestamp;
				} else {
					if (this.options.logging)
						this.log('Canvas timestamp "' + this.canvasId + '" is empty in localStorage.');
				}

				timestamp = parseInt(timestamp / 1000);
				now = parseInt(now / 1000);

				if (this.options.logging)
					this.log('Current time: "' + now + '", timestamp: "' + timestamp + '", cache time "' + this.options.cacheTime + '".');

				if (parseInt(now - timestamp) <= parseInt(this.options.cacheTime)) {
					if (this.options.logging)
						this.log('Get canvas object from localStorage and attach to background element.');

					this.options.before.call(this);
					this.attachBackground(object.value);
					this.bindScrolling();
					this.options.after.call(this);
					return this;
				} else {
					if (this.options.logging)
						this.log('Generate new canvas background (cache is outdated).');

					this.generateBackground();
					return this;
				}

			} else {
				if (this.options.logging)
					this.log('Generate new canvas background (web local storage off).');

				this.generateBackground();
				return this;
			}
		}
	};

	$.fn.blurredGround = function(options) {
		return this.each(function() {
			var $this;
			$this = $(this);
			options = $.extend({
				localStorage: true,
				cacheTime: 86400,
				processor: 'StackBlur',
				blurring: true,
				blurringRadius: 64,
				background: '#ffffff',
				offsetX: 0,
				offsetY: 0,
				opacity: 1,
				compress: 1,
				lighten: 0.5,
				logging: false,
				before: function() {},
				after: function() {}
			}, options, $this.data());
			new BlurredGround(this, options);
			return this;
		});
	};

	$.fn.blurredGround.defaults = {
		localStorage: true,
		cacheTime: 86400,
		processor: 'StackBlur',
		blurring: true,
		blurringRadius: 64,
		background: '#ffffff',
		offsetX: 0,
		offsetY: 0,
		opacity: 1,
		compress: 1,
		lighten: 0.5,
		logging: false,
		before: function() {},
		after: function() {}
	};

}).call(this);