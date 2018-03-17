# stellar-pixels
Real time pixel painting web application using Stellar. See it live at https://mfontanini.github.io/stellar-pixels/

## What is this?
This is an interactive and distributed painting application. Users can use Stellar Lumens transactions to indicate the coordinates and color they want to paint. The painted pixels will be loaded automatically by any users currently viewing the website.

## Why does this use Stellar?
Stellar's transactions can contain text memos which allows encoding extra information on each payment you make (in this case the coordinates and color to paint). Transactions are also extremely cheap so you will never be worried about pixels having a high cost. Moreover, transactions get confirmed in a matter of seconds so you can immediately propagate the pixels you paint into the rest of the users.

Pixels painted will live forever in the Stellar ledger so no matter what graffiti you want to come up with, that will always be accessible as long as nobody writes on top of it.

## Why would I trust you with my private key?
You don't have to trust me. The code used here is open source and hosted on github so you can have a look at the single javascript file this project contains and evaluate whether you want to use it or not. The rest of the javascript code used (bootstrap, jquery, etc) is pulled fron public links (e.g. cdnjs) so that you don't have to go through the entirety of it to make sure there's not some hidden code to steal your coins. Your private key will never leave your computer as this is purely a javascript website and there's no backend to it (besides the Stellar network, that is).

I would recommend that you create a new address just for this game. Send it a couple of XLM, paint some pixels and then merge the account back into your main one. With a single XLM you can paint around 99000 pixels o that's more than enough.

If you still don't trust me, you can still use the application from your own wallet. Just send a transaction containing a memo with the format `<x-coordinate> <y-coordinate> <color>` (where color has to be in the hex format without the `#` character). e.g. if you want to paint the pixel at `(X = 0, Y = 20)` using the color green, send a payment with any amount of XLM to the application's Stellar address with the following memo:

```0 20 00ff00```

You can have a look at the "current memo" field in the left panel to check what the memo would be for the pixel you're currently hovering your mouse on.

## How do I paint pixels using this website?
Once you've set your account seed in the application just click anywhere in the board to paint a pixel. You can select a color using the color picker on the left panel or by right clicking on an existing pixel to select that same color for future clicks.

## Why does it take a few seconds to paint each pixel?
Memos on Stellar are a property of a transaction, not a payment. That means we can only paint one pixel per transaction and a single account can't have multiple transactions in progress due to the way sequence numbers work. A solution would be to implement channels but I don't think silently adding additional signers to whichever account the user is using is a good idea.

## Fees per pixel
There's no restriction on how many XLM you want to send. By default the application will send the minimum amount the Stellar network supports which is 0.0000001 XLM. If you feel like being more generous, you can increase the amount you want to send on the "XLM/Pixel" control on the left bar. Note that all payments are equal: if you send 10 XLM and someone paints on top of your pixel by sending 1 XLM, your pixel will be overwritten.
