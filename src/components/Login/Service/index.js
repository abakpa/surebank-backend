const Customer = require('../../Customer/Model/index');
const Staff = require('../../Staff/Model/index');
const Login = require('../Model/index')
const AccountTransaction = require('../../AccountTransaction/Model/index');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken')
require('dotenv').config()

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(String(value || ''));

const buildCustomerUsageReport = async (query = {}) => {
    const logins = await Login.find(query)
      .populate({
          path: 'branchId',
          model: 'Branch',
      })
      .populate({
          path: 'customerId',
          model: 'Customer',
      })
      .lean();

    const customerIds = logins
      .map((login) => login.customerId?._id?.toString() || login.customerId?.toString())
      .filter(Boolean);

    const staffIds = [...new Set(logins
      .map((login) => login.accountManagerId?.toString())
      .filter((id) => id && isValidObjectId(id)))];

    const [dsTotals, sbTotals, staffList] = await Promise.all([
      AccountTransaction.aggregate([
        {
          $match: {
            customerId: { $in: customerIds },
            package: 'DS',
          }
        },
        {
          $group: {
            _id: '$customerId',
            credit: {
              $sum: {
                $cond: [{ $eq: ['$direction', 'Credit'] }, '$amount', 0]
              }
            },
            debit: {
              $sum: {
                $cond: [{ $in: ['$direction', ['Debit', 'Charge']] }, '$amount', 0]
              }
            },
            transactions: { $sum: 1 }
          }
        }
      ]),
      AccountTransaction.aggregate([
        {
          $match: {
            customerId: { $in: customerIds },
            package: 'SB',
            direction: { $in: ['Debit', 'Purchased', 'Bought', 'Delivered'] },
            narration: { $not: /^Reversed payment reservation for changed product:/i }
          }
        },
        {
          $group: {
            _id: '$customerId',
            total: { $sum: '$amount' },
            transactions: { $sum: 1 }
          }
        }
      ]),
      Staff.find({ _id: { $in: staffIds } }).select('_id firstName lastName role branchId').lean()
    ]);

    const dsTotalMap = new Map(dsTotals.map((item) => [item._id?.toString(), item]));
    const sbTotalMap = new Map(sbTotals.map((item) => [item._id?.toString(), item]));
    const staffMap = new Map(staffList.map((staff) => [staff._id.toString(), staff]));

    return logins.map((login) => {
      const customerId = login.customerId?._id?.toString() || login.customerId?.toString();
      const ds = dsTotalMap.get(customerId) || {};
      const sb = sbTotalMap.get(customerId) || {};
      const staff = staffMap.get(login.accountManagerId?.toString()) || null;
      const dsCredit = Number(ds.credit || 0);
      const dsDebit = Number(ds.debit || 0);
      const dsNet = Math.max(0, dsCredit - dsDebit);
      const sbPurchaseTotal = Number(sb.total || 0);

      return {
        ...login,
        accountManager: staff ? {
          _id: staff._id,
          firstName: staff.firstName,
          lastName: staff.lastName,
          role: staff.role,
          branchId: staff.branchId,
        } : null,
        performance: {
          dsTotal: dsNet,
          dsCreditTotal: dsCredit,
          dsDebitTotal: dsDebit,
          dsTransactionCount: Number(ds.transactions || 0),
          sbPurchaseTotal,
          sbTransactionCount: Number(sb.transactions || 0),
          combinedTotal: dsNet + sbPurchaseTotal,
        }
      };
    });
};

const customerLogin = async (phone, password) => {
    try {
        // Find customer by phone
        const customer = await Customer.findOne({ phone });
        if (!customer) {
            throw new Error('Invalid phone number or password');
        }
        // Check if password needs to be updated
        if (customer.updatePassword !== "false") {
            throw new Error('Update your password');
        }

        // Verify password
        const isMatch = await bcrypt.compare(password, customer.password);
        if (!isMatch) {
            throw new Error('Invalid Phone number or password');
        }

        // Generate JWT token
        const token = jwt.sign(
            { id: customer._id, phone: customer.phone },
            process.env.JWT_SECRET_KEY, 
            { expiresIn: process.env.JWT_LIFETIME }
        );

        // Check Login model and update count or create new entry
        const existingLogin = await Login.findOne({ customerId: customer._id });
        
        if (existingLogin) {
            // Increment count for returning customer
            existingLogin.count += 1;
            existingLogin.lastLogin = new Date();
            await existingLogin.save();
        } else {
            // Create new entry for first-time login
            await Login.create({
                customerId: customer._id,
                branchId:customer.branchId,
                accountManagerId:customer.accountManagerId,
                count: 1,
                firstLogin: new Date(),
                lastLogin: new Date()
            });
        }

        return { customer, token };
    } catch (error) {
        throw error;
    }
};
const getCustomers = async () =>{
    try {
        return await buildCustomerUsageReport({});
    } catch (error) {
        throw error;
    }
  }
const getBranchCustomers = async (branchId) =>{
    try {
        return await buildCustomerUsageReport({ branchId });
    } catch (error) {
        throw error;
    }
  }
const getRepCustomers = async (repId) =>{
    
    try {
        return await buildCustomerUsageReport({ accountManagerId: repId });
    } catch (error) {
        throw error;
    }
  }
  const blockAllUsersService = async () => {
    try {
      // Update all non-admin users in a single atomic operation
      const result = await Staff.updateMany(
        { role: { $ne: "Admin" }, loginDisabled: { $ne: true } },
        { 
          $inc: { tokenVersion: 1 }, // Invalidate all tokens
          $set: { loginDisabled: true } // Block new logins
        }
      );
  
      if (result.modifiedCount === 0) {
        throw new Error('No non-admin users were found to update');
      }
  
      return { 
        success: true, 
        blockedUsers: result.modifiedCount,
        message: `Successfully blocked ${result.modifiedCount} non-admin users`
      };
    } catch (error) {
      throw error; // Let the controller handle the error
    }
  };
  // Unblock all users (reset to defaults)
const unblockAllUsersService = async () => {
    try {
      const result = await Staff.updateMany(
        {
          role: { $ne: "Admin" },
          $or: [
            { loginDisabled: true },
            { tokenVersion: { $gt: 0 } }
          ]
        },
        { 
          $set: { 
            tokenVersion: 0,       // Reset token version
            loginDisabled: false   // Allow logins
          } 
        }
      );
  
      return { 
        success: true,
        unblockedUsers: result.modifiedCount,
        message: `Reset ${result.modifiedCount} users to active status`
      };
    } catch (error) {
      throw error;
    }
  };
const staffLogin = async (email, password) => {
    try {
        const staff = await Staff.findOne({ email });
        if (!staff) {
            throw new Error('Invalid email or password');
        }
        if (staff.status !== "isActive") {
            throw new Error('Staff is deactivated');
        }
        if (staff.updatePassword !== "false") {
            throw new Error('Update your password');
        }
        const isMatch = await bcrypt.compare(password, staff.password);
        if (!isMatch) {
            throw new Error('Invalid email or password');
        }
          // Check if login is disabled
  if (staff.loginDisabled) {
    throw new Error('Account temporarily disabled')
    // return res.status(403).json({ error: "Account temporarily disabled" });
  }
        const token = jwt.sign({ id: staff._id, tokenVersion: staff.tokenVersion, email: staff.email },
            process.env.JWT_SECRET_KEY, { expiresIn: process.env.JWT_LIFETIME }
        );
        return {staff,token};
    } catch (error) {
        throw error;
    }
};

module.exports = {
    customerLogin,
    staffLogin,
    getCustomers,
    blockAllUsersService,
    unblockAllUsersService,
    getBranchCustomers,
    getRepCustomers
};
