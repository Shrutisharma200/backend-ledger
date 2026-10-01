const transactionModel = require("../models/transaction.model");
const ledgerModel = require("../models/ledger.model");
const accountModel = require("../models/account.model");
const emailServices = require("../services/email.service");
const mongoose = require("mongoose");

async function createTransaction(req, res) {

    /**
     * 1.Validate request
     */

    const { fromAccount, toAccount, amount, idempotencyKey } = req.body;

    if (!fromAccount || !toAccount || !amount || !idempotencyKey) {
        return res.status(400).json({
            message: "FromAccount, toAccount, amount and idempotencyKey are required"
        });
    }

    const fromUserAccount = await accountModel.findOne({
        _id: fromAccount
    });

    const toUserAccount = await accountModel.findOne({
        _id: toAccount
    });

    if (!fromUserAccount || !toUserAccount) {
        return res.status(400).json({
            message: "Invalid fromAccount or toAccount"
        });
    }

    // 2. Validate idempotency key

    const isTransactionAlreadyExists = await transactionModel.findOne({
        idempotencyKey: idempotencyKey
    });

    if (isTransactionAlreadyExists) {

        if (isTransactionAlreadyExists.status === "COMPLETED") {
            return res.status(200).json({
                message: "Transaction already processed",
                transaction: isTransactionAlreadyExists
            });
        }

        if (isTransactionAlreadyExists.status === "PENDING") {
            return res.status(200).json({
                message: "Transaction is still processing",
                transaction: isTransactionAlreadyExists
            });
        }

        if (isTransactionAlreadyExists.status === "FAILED") {
            return res.status(500).json({
                message: "Transaction processing failed, please retry"
            });
        }

        if (isTransactionAlreadyExists.status === "REVERSED") {
            return res.status(500).json({
                message: "Transaction was reversed, please retry"
            });
        }
    }

    /**
     * 3. check account status
     */

    if (fromUserAccount.status !== "ACTIVE" || toUserAccount.status !== "ACTIVE") {
        return res.status(400).json({
            message: "Both fromAccount and toAccount must be ACTIVE must be process transaction"
        });
    }

    /**
     * 4.Derive sender balance from ledger
     */

    const balance = await fromUserAccount.getBalance();

    if (balance < amount) {
        return res.status(400).json({
            message: `Insufficient balance.Current balance is ${balance}.Requested amount is ${amount}`
        });
    }

    // Session try ke bahar rakha hai
    const session = await mongoose.startSession();

    try {

        /**
         * 5. Create transaction (PENDING)
         */

        session.startTransaction();

        const transaction = (
            await transactionModel.create([{
                fromAccount,
                toAccount,
                amount,
                idempotencyKey,
                status: "PENDING"
            }], { session })
        )[0];

        /**
         * 6. Debit sender
         */

        await ledgerModel.create([{
            account: fromAccount,
            amount: amount,
            transaction: transaction._id,
            type: "DEBIT"
        }], { session });

        /**
         * 7. Wait for testing
         */

        await new Promise((resolve) => {
            setTimeout(resolve, 10 * 1000);
        });

        /**
         * 8. Credit receiver
         */

        await ledgerModel.create([{
            account: toAccount,
            amount: amount,
            transaction: transaction._id,
            type: "CREDIT"
        }], { session });

        /**
         * 9. Complete transaction
         */

        await transactionModel.findOneAndUpdate(
            { _id: transaction._id },
            { status: "COMPLETED" },
            { session }
        );

        await session.commitTransaction();

        session.endSession();

        /**
         * 10. Send email notification
         */

        await emailServices.sendTransactionEmail(
            req.user.email,
            req.user.name,
            amount,
            toAccount
        );

        return res.status(201).json({
            message: "Transaction completed successfully",
            transaction: transaction
        });

    } catch (error) {

        // Error hone par transaction rollback
        await session.abortTransaction();
        session.endSession();

        return res.status(400).json({
            message: "Transaction is pending due to some isuue, please retry after some time"
        });
    }
}


async function createInitialFundsTransaction(req, res) {

    const { toAccount, amount, idempotencyKey } = req.body;

    if (!toAccount || !amount || !idempotencyKey) {
        return res.status(400).json({
            message: "toAccount , amount and idempotencyKey are required"
        });
    }

    const toUserAccount = await accountModel.findOne({
        _id: toAccount,
    });

    if (!toUserAccount) {
        return res.status(400).json({
            message: "Invalid toAccount"
        });
    }

    const fromAccount = await accountModel.findOne({
        user: req.user._id
    });

    if (!fromAccount) {
        return res.status(400).json({
            message: "System user account not found"
        });
    }

    // Idempotency check
    const existingTransaction = await transactionModel.findOne({
        idempotencyKey
    });

    if (existingTransaction) {
        return res.status(200).json({
            message: "Transaction already processed",
            transaction: existingTransaction
        });
    }

    const session = await mongoose.startSession();

    try {

        session.startTransaction();

        const transaction = new transactionModel({
            fromAccount: fromAccount._id,
            toAccount,
            amount,
            idempotencyKey,
            status: "PENDING"
        });

        await ledgerModel.create([{
            account: fromAccount._id,
            amount: amount,
            transaction: transaction._id,
            type: "DEBIT"
        }], { session });

        await ledgerModel.create([{
            account: toUserAccount._id,
            amount: amount,
            transaction: transaction._id,
            type: "CREDIT"
        }], { session });

        transaction.status = "COMPLETED";

        await transaction.save({ session });

        await session.commitTransaction();

        return res.status(201).json({
            message: "Initial funds transaction completed successfully",
            transaction: transaction
        });

    } catch (error) {

        await session.abortTransaction();

        return res.status(400).json({
            message: "Initial funds transaction failed"
        });

    } finally {

        session.endSession();
    }
}


module.exports = {
    createTransaction,
    createInitialFundsTransaction
};