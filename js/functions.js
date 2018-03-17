class Board {
    constructor(width, height, pixelSize, canvas, stellar) {
        this.width = width;
        this.height = height;
        this.pixelSize = pixelSize;
        this.canvas = canvas;
        this.cursor = 0;
        this.state = [];
        this.stellar = stellar;
        for(var x = 0; x < width; x++) {
            this.state[x] = new Array(height);
            for (var y = 0; y < height; ++y) {
                this.setColor(x, y, '#ffffff');
            }
        }
    }

    setCursor(cursor) {
        this.cursor = cursor;
    }

    setColor(x, y, color) {
        if (!this.isValidCoordinate(x, y)) {
            return;
        }
        this.state[x][y] = color;
        this.renderPixel(x, y);
    }

    isValidCoordinate(x, y) {
        return x >= 0 && x < this.width && y >= 0 && y < this.height;
    }

    render() {
        var context = this.canvas.getContext('2d');
        for(var x = 0; x < this.width; x++) {
            for (var y = 0; y < this.height; ++y) {
                this.renderPixel(x, y, context);
            }
        }
    }

    renderPixel(x, y, context) {
        if (!this.isValidCoordinate(x, y)) {
            return;
        }
        if (!context) {
            context = this.canvas.getContext('2d');
        }
        context.fillStyle = this.state[x][y];
        context.fillRect(
            x * this.pixelSize,
            y * this.pixelSize,
            this.pixelSize,
            this.pixelSize
        );
    }

    paintHoveredPixel(x, y, color, context) {
        if (!this.isValidCoordinate(x, y)) {
            return;
        }
        if (!context) {
            context = this.canvas.getContext('2d');
        }
        // Draw a full rect with the given color
        context.fillStyle = color;
        context.fillRect(
            x * this.pixelSize,
            y * this.pixelSize,
            this.pixelSize,
            this.pixelSize
        );
        // Now draw a smaller rect using the actual cell color by removing one pixel per side
        context.fillStyle = this.state[x][y];
        context.fillRect(
            x * this.pixelSize + 1,
            y * this.pixelSize + 1,
            this.pixelSize - 2,
            this.pixelSize - 2
        );
    }

    computeCoordinates(absoluteX, absoluteY) {
        var rect = this.canvas.getBoundingClientRect();
        var x = (absoluteX - rect.left - 2) - this.pixelSize / 2;
        var y = (absoluteY - rect.top - 2.5) - this.pixelSize / 2;
        return {
            x : parseInt(x / this.pixelSize),
            y : parseInt(y / this.pixelSize)
        };
    }

    setupEvents() {
        var self = this;
        this.canvas.addEventListener('click', function(event) {
            var coordinates = self.computeCoordinates(event.pageX, event.pageY);
            if (!self.isValidCoordinate(coordinates.x, coordinates.y)) {
                return;
            }
            if (self.stellar.hasPaymentAccount()) {
                self.paintHoveredPixel(
                    coordinates.x,
                    coordinates.y,
                    drawingState.getColor()
                );
                self.stellar.sendPixel(
                    coordinates.x,
                    coordinates.y,
                    drawingState.getColor()
                );
            }
            else {
                $('#login-modal').modal('toggle');
                $('#login-invalid-feedback').html('Seed must be set in order to paint pixels');
            }
        });
        // Handle right click
        this.canvas.addEventListener('contextmenu', function(event) {
            // Don't show the menu
            event.preventDefault();
            var coordinates = self.computeCoordinates(event.pageX, event.pageY);
            if (!self.isValidCoordinate(coordinates.x, coordinates.y)) {
                return;
            }
            drawingState.setColor(self.state[coordinates.x][coordinates.y]);
        });
        this.canvas.addEventListener('mousemove', function(event) {
            var coordinates = self.computeCoordinates(event.pageX, event.pageY);
            drawingState.onMouseMove(coordinates.x, coordinates.y);
        });
        this.canvas.addEventListener('mouseout', function(event) {
            drawingState.onMouseOut();
        });
    }
}

class DrawingState {
    constructor(board, colorPicker, memoDisplay, stellar) {
        this.mouseCoordinates = null;
        this.board = board;
        this.colorPicker = colorPicker;
        this.memoDisplay = memoDisplay;
        this.stellar = stellar;
    }

    setColor(color) {
        this.colorPicker.spectrum("set", color);
    }

    getColor() {
        return this.colorPicker.spectrum("get").toHexString();
    }

    onMouseMove(x, y) {
        if (this.mouseCoordinates != null) {
            // If the mouse hasn't moved, don't do anything
            if (this.mouseCoordinates.x == x && this.mouseCoordinates.y == y) {
                return;
            }
            // Only render it if we're not actually waiting for it to be painted
            if (!this.stellar.isPixelPending(this.mouseCoordinates.x, this.mouseCoordinates.y)) {
                this.board.renderPixel(this.mouseCoordinates.x, this.mouseCoordinates.y);
            }
        }
        var memo = this.stellar.memoEncode(
            x, y, this.getColor()
        );
        this.memoDisplay.val(memo);
        // Only paint as hovered if it's not already pending
        if (!this.stellar.isPixelPending(x, y)) {
            this.board.paintHoveredPixel(x, y, this.getColor());
        }
        this.mouseCoordinates = {
            x : x,
            y : y
        };
    }

    onMouseOut() {
        if (this.mouseCoordinates != null &&
            !this.stellar.isPixelPending(this.mouseCoordinates.x, this.mouseCoordinates.y)) {
            this.board.renderPixel(this.mouseCoordinates.x, this.mouseCoordinates.y);
        }
        this.mouseCoordinates = null;
    }
}

class StellarInterface {
    constructor(paymentAmount, boardAddress, eventsArea, queuedEventsCount,
                queuedEventsBody, server) {
        this.paymentKeyPair = null;
        this.paymentAccount = null;
        this.paymentAmount = paymentAmount;
        this.boardAddress = boardAddress;
        this.eventsArea = eventsArea;
        this.queuedEventsCount = queuedEventsCount;
        this.queuedEventsBody = queuedEventsBody;
        this.server = server;
        this.pendingOperations = [];
        this.pendingPixels = new Set();
    }

    setPaymentAccount(paymentKeyPair, paymentAccount) {
        this.paymentKeyPair = paymentKeyPair;
        this.paymentAccount = paymentAccount;
    }

    hasPaymentAccount() {
        return this.paymentAccount != null;
    }

    setPaymentAmount(value) {
        this.paymentAmount = value;
    }

    isPixelPending(x, y) {
        return this.pendingPixels.has(JSON.stringify([ x, y ]));
    }

    findPendingOperation(operation) {
        for (var i = 0; i < this.pendingOperations.length; ++i) {
            var j = 0;
            for (; j < operation.length; ++j) {
                if (operation[j] != this.pendingOperations[i][j]) {
                    break;
                }
            }
            if (j == operation.length) {
                return i;
            }
        }
        return -1;
    }

    addPendingOperation(operation) {
        this.pendingOperations.push(operation);
        // Javascript, u suck
        this.pendingPixels.add(JSON.stringify([ operation[0], operation[1] ]));
        this.updatePendingRequests();
    }

    removePendingOperation(operation) {
        this.pendingOperations = this.pendingOperations.splice(1);
        this.pendingPixels.delete(JSON.stringify([ operation[0], operation[1] ]));
        this.updatePendingRequests();
    }

    updatePendingRequests() {
        var suffix = 's';
        if (this.pendingOperations.length == 1) {
            suffix = '';
        }
        this.queuedEventsCount.text(this.pendingOperations.length);
        if (this.pendingOperations.length == 0) {
            this.queuedEventsBody.html('No pending events');
        }
        else {
            var eventList = '';
            for (var i = 0; i < this.pendingOperations.length; ++i) {
                eventList += this.pendingOperations[i][2] + " @ ("
                             + this.pendingOperations[i][0] + ", "
                             + this.pendingOperations[i][1] + ")<br />";
            }
            this.queuedEventsBody.html(eventList);
        }
    }

    getDescriptiveReason(reason) {
        var mappings = {
            'op_underfunded' : 'Not enough balance'
        };
        return (reason in mappings) ? mappings[reason] : reason;
    }

    processPendingOperation() {
        if (this.pendingOperations.length == 0) {
            return;
        }

        var operation = this.pendingOperations[0];
        console.log(`Sending ${this.paymentAmount} XLM for pixel (${operation[0]}, ${operation[1]})`);
        // Build and submit the stellar transaction
        var memo = this.memoEncode(operation[0], operation[1],  operation[2]);
        var transaction = new StellarSdk.TransactionBuilder(this.paymentAccount)
            .addOperation(StellarSdk.Operation.payment({
                destination: this.boardAddress,
                asset: StellarSdk.Asset.native(),
                amount: this.paymentAmount,
            }))
            .addMemo(StellarSdk.Memo.text(memo))
            .build();
        transaction.sign(this.paymentKeyPair);

        var self = this;
        this.server.submitTransaction(transaction)
            .then(function (transactionResult) {
                self.removePendingOperation(operation);
                // Process another one, if any
                self.processPendingOperation();
            })
            .catch(function(err) {
                // Transaction failed. Remove it and add an event for it in the events area
                self.removePendingOperation(operation);
                var reason = err.data.extras.result_codes.operations[0];
                self.eventsArea.addTransactionFailEvent(
                    new Date(),
                    operation[0],
                    operation[1],
                    self.getDescriptiveReason(reason)
                );
                board.renderPixel(operation[0], operation[1]);
                // Process another one, if any
                self.processPendingOperation();
            });
    }
    
    memoEncode(x, y, color) {
        return x + ' ' + y + ' ' + color.substring(1);
    }

    sendPixel(x, y, color) {
        if (this.isPixelPending(x, y)) {
            console.log('Ignoring duplicate operation for (' + x + ', ' + y + ')');
            return;
        }
        var operation = [x, y, color];
        this.addPendingOperation(operation);
        // We're already waiting for some operation to complete. We'll just wait, as the callback
        // for it will process any pending operations.
        if (this.pendingOperations.length > 1) {
            return;
        }
        this.processPendingOperation();
    }

    streamEvents(startCursor, lastKnownCursor, callback) {
        var self = this;
        console.log('Starting event consumption from cursor ' + startCursor);

        // If we're starting at the last cursor then we basically are done loading everything
        if (startCursor == lastKnownCursor) {
            callback();
            callback = function() {};
        }
        // Stream transactions and handle them
        this.server.transactions()
                   .forAccount(this.boardAddress)
                   .cursor(startCursor)
                   .limit(30)
                   .stream({ onmessage: function(transaction) {
                        self.onBoardTransaction(transaction);
                        if (transaction.paging_token == lastKnownCursor) {
                            callback();
                        }
                   }});
    }

    processEvents(cursor, callback) {
        var self = this;
        console.log('Fetching last transaction for account');

        // See what the latest transaction is so we know when we're done loading
        this.server.transactions()
                   .forAccount(this.boardAddress)
                   .limit(1)
                   .order('desc')
                   .call()
                   .then(function(transaction) {
                        self.streamEvents(cursor, transaction.records[0].paging_token, callback)
                   });
    }

    onBoardTransaction(transaction) {
        var memoRegex = /^([\d]+) ([\d]+) ([a-f0-9]{6})$/;
        // TODO: Apply address and operation checks
        if (transaction.memo) {
            var parsed = memoRegex.exec(transaction.memo);
            if (parsed) {
                var x = Number(parsed[1]);
                var y = Number(parsed[2]);
                board.setColor(x, y, '#' + parsed[3]);
                board.renderPixel(x, y);

                this.eventsArea.addPaintEvent(
                    transaction.created_at,
                    transaction.source_account,
                    x,
                    y
                );
            }
        }
    }
}

class EventsArea {
    constructor(element, maxElements) {
        this.element = element;
        this.maxElements = maxElements;
    }

    dateToString(date) {
        var expandNumber = function(number) {
            return ('0' + number).slice(-2);
        };
        return expandNumber(date.getDay()) + "/" + expandNumber(date.getMonth()) + "/" +
               expandNumber(date.getFullYear()) + " " + expandNumber(date.getHours()) + ":" +
               expandNumber(date.getMinutes()) + ":" + expandNumber(date.getSeconds());
    }

    addText(text, color, time) {
        if (time == null) {
            time = new Date();
        }
        var localTime = new Date(time);
        // Prepend the option
        this.element.prepend($('<option>', {
            text: this.dateToString(localTime) + ": " + text,
            style: 'color: ' + color
        }));
        // Now remove any options beyond the configured amount
        var maxElements = this.maxElements;
        this.element.children()
                    .filter(function(index) { return index >= maxElements; })
                    .remove();
    }

    addPaintEvent(time, account, x, y) {
        var eventText = account + " painted (" + x + ", " + y + ")\n";
        this.addText(eventText, '#00a800', time);
    }

    addTransactionFailEvent(time, x, y, reason) {
        var eventText = "Transaction for (" + x + ", " + y + ") failed: " + reason + "\n";
        this.addText(eventText, '#f22b10', time);
    }
}

StellarSdk.Network.usePublicNetwork();
var horizonEndpoint = 'https://horizon.stellar.org';
var horizonServer = new StellarSdk.Server(horizonEndpoint);
var boardAddress = 'GA3DNX4WYHGARHXLJF4X2YKGXCVIRW6OQBQR6OA7BMHFAP77GUBLIAB6';
var isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

function setupBoard(width, height, pixelSize, stellar) {
    var element = document.createElement('canvas');
    element.id = 'board';
    element.width = width * pixelSize;
    element.height = height * pixelSize;
    $('#board-div').append(element);

    var palleteStorageKey = 'color.pallete';
    var color = '#000000';
    var colors = window.localStorage.getItem(palleteStorageKey);
    if (colors != null) {
        colors = colors.split(';');
        color = colors.pop();
    }
    var colorPicker = $("#colorPicker");
    colorPicker.spectrum({ 
        flat: true,
        showInitial: true,
        localStorageKey: palleteStorageKey,
        color: color,
    });

    window.board = new Board(width, height, pixelSize, element, stellar);
    window.drawingState = new DrawingState(board, colorPicker, $('#memo-display'), stellar);
    if (isMobile) {
        $('#board-div').addClass('scroll-div');
        $('#events-area-div').addClass('scroll-div');
    }
}

function setupStellar( callback) {
    window.stellar = new StellarInterface(
        '0.0000001', // Initial cost per pixel
        boardAddress,
        window.eventsArea,
        $('#queued-events-count'),
        $('#queued-events-body'),
        horizonServer
    );
    callback(window.stellar);
}

function setupControls() {
    window.scrollTo(0, 0);
    // Create the events area wrapper and allow up to 20 events
    window.eventsArea = new EventsArea($('#events-area'), 20);
    $('#lumens-amount-display').on('input change', function(event) {
        var element = $(event.target);
        var value = parseFloat(element.val());
        var minimumValue = 0.0000001;
        if (value < minimumValue) {
            console.log('XLM value is too small, defaulting to minimum');
            element.val(minimumValue.toFixed(7));
        }
        else if (value.toString().indexOf('e') != -1) {
            // Don't show e-notation floats
            element.val(value.toFixed(7));
        }
        stellar.setPaymentAmount(element.val());
    });
    var cleanupLoginModal = function(element) {
        $('#login-invalid-feedback').html('');
        $('#seed-input').val('');
    };
    $('#login-close-button').click(function(event) {
        var element = $(event.target);
        cleanupLoginModal(element);
    });
    // On login, get seed and load account
    $('#login-button').click(function(event) {
        var errorArea = $('#login-invalid-feedback');
        var seed = $('#seed-input').val();
        try {
            var keyPair = StellarSdk.Keypair.fromSecret(seed);
        }
        catch (error) {
            errorArea.html('Invalid Stellar account seed');
            return;
        }
        horizonServer.loadAccount(keyPair.publicKey())
            .then(function(account) {
                stellar.setPaymentAccount(keyPair, account);
                $('#login-modal').modal('toggle');
                $('#set-seed-button').hide();
            })
            .catch(function() {
                errorArea.html('Account does not exist');
            });
    });
    $('#board-address').val(boardAddress);

    $('#login-modal').on('shown.bs.modal', function() {
        $('#seed-input').focus();
    });

    // Clean this up just in case someone reloads while their seed is there
    cleanupLoginModal();
}

function loadState() {
    setupStellar(function(stellar) {
        $.getJSON(
            'state.json',
            function(data, status) {
                // Build the board and other tracked state
                setupBoard(data['width'], data['height'], 6, stellar);
                // Set each pixel
                var state = data['state'];
                for (var x = 0; x < state.length; ++x) {
                    for (var y = 0; y < state[x].length; ++y) {
                        board.setColor(x, y, '#' + state[x][y]);
                    }
                }
                var cursor = data['cursor'];
                board.setCursor(cursor);

                stellar.processEvents(
                    cursor,
                    function() {
                        eventsArea.addText('Finished loading events', '0000ff');
                        board.setupEvents();
                    }
                );
            }
        );
    });
}
