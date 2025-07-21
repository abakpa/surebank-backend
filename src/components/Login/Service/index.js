const Customer = require('../../Customer/Model/index');
const Staff = require('../../Staff/Model/index');
const Login = require('../Model/index')
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken')
require('dotenv').config()

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
        return await Login.find({}).populate({
            path: 'branchId',
            model: 'Branch',
          })
          .populate({
            path: 'customerId',
            model: 'Customer',
          });
    } catch (error) {
        throw error;
    }
  }
const getBranchCustomers = async (branchId) =>{
    try {
        return await Login.find({branchId:branchId}).populate({
            path: 'branchId',
            model: 'Branch',
          })
          .populate({
            path: 'customerId',
            model: 'Customer',
          });
    } catch (error) {
        throw error;
    }
  }
const getRepCustomers = async (repId) =>{
    
    try {
        return await Login.find({accountManagerId:repId}).populate({
            path: 'branchId',
            model: 'Branch',
          })
          .populate({
            path: 'customerId',
            model: 'Customer',
          });
    } catch (error) {
        throw error;
    }
  }
  const blockAllUsersService = async () => {
    try {
      // Update all non-admin users in a single atomic operation
      const result = await Staff.updateMany(
        { role: { $ne: "Admin" } }, // Filter: role not equal to Admin
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
        {}, // All users
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
