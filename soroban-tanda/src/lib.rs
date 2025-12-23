//! Tanda (ROSCA) Smart Contract v2 - Simplified Model
//!
//! A Rotating Savings and Credit Association on Soroban.
//!
//! Key features:
//! - No fixed time cycles - tanda ends when everyone has received
//! - Anyone can trigger payout when all deposits are in
//! - Anyone can expel delinquent members (6 days without payment)
//! - Self-regulating, trustless design

#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype,
    Address, BytesN, Env, Map, String, Symbol, Vec,
    token::Client as TokenClient,
};

// ==================== CONSTANTS ====================

/// Days before a member can be expelled for non-payment
const DELINQUENCY_DAYS: u64 = 6;
/// Seconds in a day
const SECONDS_PER_DAY: u64 = 86400;

// ==================== DATA TYPES ====================

/// Tanda status
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum TandaStatus {
    Forming,    // Waiting for members to join
    Active,     // In progress - accepting deposits and payouts
    Completed,  // All members have received their payout
    Cancelled,  // Cancelled by vote
}

/// Member status within a tanda
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum MemberStatus {
    Active,     // Can deposit and receive payout
    Received,   // Already received payout (still must deposit)
    Expelled,   // Removed for non-payment
}

/// A tanda member
#[contracttype]
#[derive(Clone, Debug)]
pub struct Member {
    pub address: Address,
    pub status: MemberStatus,
    pub position: u32,           // Payout order (0 = first to receive)
    pub has_deposited: bool,     // Deposited for current cycle
    pub joined_at: u64,
}

/// A complete tanda
#[contracttype]
#[derive(Clone, Debug)]
pub struct Tanda {
    pub id: String,
    pub name: String,
    pub creator: Address,
    pub amount: i128,            // Amount per cycle in EURC (7 decimals)
    pub max_members: u32,
    pub status: TandaStatus,
    pub current_cycle: u32,      // Which payout we're on (1-indexed)
    pub total_cycles: u32,       // = number of active members
    pub created_at: u64,
    pub started_at: u64,
    pub last_payout_at: u64,     // Timestamp of last payout (for delinquency calc)
}

/// Storage keys
#[contracttype]
pub enum DataKey {
    // Global
    Admin,
    EurcToken,
    CommissionAddress,
    CommissionBps,              // Commission in basis points (100 = 1%)
    TandaCount,

    // Per tanda
    Tanda(String),              // Tanda data by ID
    Members(String),            // Vec<Member> - members of tanda
    SafetyFund(String),         // Accumulated safety fund for tanda
}

// ==================== CONTRACT ====================

#[contract]
pub struct TandaContract;

#[contractimpl]
impl TandaContract {
    // ==================== INITIALIZATION ====================

    /// Initialize the contract (called once)
    pub fn initialize(
        env: Env,
        admin: Address,
        eurc_token: Address,
        commission_address: Address,
        commission_bps: u32,
    ) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::EurcToken, &eurc_token);
        env.storage().instance().set(&DataKey::CommissionAddress, &commission_address);
        env.storage().instance().set(&DataKey::CommissionBps, &commission_bps);
        env.storage().instance().set(&DataKey::TandaCount, &0u32);
    }

    // ==================== ADMIN FUNCTIONS ====================

    /// Upgrade the contract code (admin only)
    pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) {
        let admin: Address = env.storage().instance()
            .get(&DataKey::Admin)
            .expect("not initialized");
        admin.require_auth();

        env.deployer().update_current_contract_wasm(new_wasm_hash);
    }

    /// Update commission settings (admin only)
    pub fn set_commission(env: Env, commission_address: Address, commission_bps: u32) {
        let admin: Address = env.storage().instance()
            .get(&DataKey::Admin)
            .expect("not initialized");
        admin.require_auth();

        if commission_bps > 1000 {
            panic!("commission too high (max 10%)");
        }

        env.storage().instance().set(&DataKey::CommissionAddress, &commission_address);
        env.storage().instance().set(&DataKey::CommissionBps, &commission_bps);
    }

    /// Transfer admin role (admin only)
    pub fn set_admin(env: Env, new_admin: Address) {
        let admin: Address = env.storage().instance()
            .get(&DataKey::Admin)
            .expect("not initialized");
        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &new_admin);
    }

    /// Get current admin
    pub fn get_admin(env: Env) -> Address {
        env.storage().instance()
            .get(&DataKey::Admin)
            .expect("not initialized")
    }

    // ==================== TANDA LIFECYCLE ====================

    /// Create a new tanda
    pub fn create_tanda(
        env: Env,
        creator: Address,
        name: String,
        amount: i128,
        max_members: u32,
    ) -> String {
        creator.require_auth();

        // Validate
        if amount <= 0 {
            panic!("amount must be positive");
        }
        if max_members < 2 || max_members > 12 {
            panic!("members must be 2-12");
        }

        // Generate ID
        let count: u32 = env.storage().instance()
            .get(&DataKey::TandaCount)
            .unwrap_or(0);
        let new_count = count + 1;
        env.storage().instance().set(&DataKey::TandaCount, &new_count);

        let id = Self::generate_id(&env, new_count);
        let now = env.ledger().timestamp();

        // Create tanda
        let tanda = Tanda {
            id: id.clone(),
            name,
            creator: creator.clone(),
            amount,
            max_members,
            status: TandaStatus::Forming,
            current_cycle: 0,
            total_cycles: 0,
            created_at: now,
            started_at: 0,
            last_payout_at: 0,
        };

        // Creator is first member
        let member = Member {
            address: creator.clone(),
            status: MemberStatus::Active,
            position: 0,
            has_deposited: false,
            joined_at: now,
        };

        let mut members: Vec<Member> = Vec::new(&env);
        members.push_back(member);

        // Save
        env.storage().persistent().set(&DataKey::Tanda(id.clone()), &tanda);
        env.storage().persistent().set(&DataKey::Members(id.clone()), &members);
        env.storage().persistent().set(&DataKey::SafetyFund(id.clone()), &0i128);

        env.events().publish(
            (Symbol::new(&env, "tanda_created"), creator),
            id.clone(),
        );

        id
    }

    /// Join a tanda (while in Forming status)
    pub fn join_tanda(env: Env, user: Address, tanda_id: String) {
        user.require_auth();

        let tanda: Tanda = Self::get_tanda_internal(&env, &tanda_id);

        if tanda.status != TandaStatus::Forming {
            panic!("tanda not accepting members");
        }

        let mut members: Vec<Member> = Self::get_members_internal(&env, &tanda_id);

        if members.len() >= tanda.max_members {
            panic!("tanda is full");
        }

        // Check not already member
        for m in members.iter() {
            if m.address == user {
                panic!("already a member");
            }
        }

        // Add member
        let now = env.ledger().timestamp();
        let member = Member {
            address: user.clone(),
            status: MemberStatus::Active,
            position: members.len() as u32,
            has_deposited: false,
            joined_at: now,
        };

        members.push_back(member);
        env.storage().persistent().set(&DataKey::Members(tanda_id.clone()), &members);

        env.events().publish(
            (Symbol::new(&env, "member_joined"), user),
            tanda_id,
        );
    }

    /// Start the tanda (creator only, requires at least 2 members)
    pub fn start_tanda(env: Env, caller: Address, tanda_id: String) {
        caller.require_auth();

        let mut tanda: Tanda = Self::get_tanda_internal(&env, &tanda_id);

        if tanda.creator != caller {
            panic!("only creator can start");
        }
        if tanda.status != TandaStatus::Forming {
            panic!("tanda not in forming state");
        }

        let members: Vec<Member> = Self::get_members_internal(&env, &tanda_id);
        let member_count = members.len() as u32;

        if member_count < 2 {
            panic!("need at least 2 members");
        }

        // Start tanda
        let now = env.ledger().timestamp();
        tanda.status = TandaStatus::Active;
        tanda.started_at = now;
        tanda.last_payout_at = now; // Start the 6-day clock
        tanda.current_cycle = 1;
        tanda.total_cycles = member_count;

        env.storage().persistent().set(&DataKey::Tanda(tanda_id.clone()), &tanda);

        env.events().publish(
            (Symbol::new(&env, "tanda_started"), caller),
            tanda_id,
        );
    }

    // ==================== CORE OPERATIONS ====================

    /// Deposit for current cycle
    pub fn deposit(env: Env, user: Address, tanda_id: String) {
        user.require_auth();

        let tanda: Tanda = Self::get_tanda_internal(&env, &tanda_id);

        if tanda.status != TandaStatus::Active {
            panic!("tanda not active");
        }

        let mut members: Vec<Member> = Self::get_members_internal(&env, &tanda_id);

        // Find member and check status
        let mut member_idx: Option<u32> = None;
        for (i, m) in members.iter().enumerate() {
            if m.address == user {
                if m.status == MemberStatus::Expelled {
                    panic!("member was expelled");
                }
                if m.has_deposited {
                    panic!("already deposited this cycle");
                }
                member_idx = Some(i as u32);
                break;
            }
        }

        let idx = member_idx.expect("not a member");

        // Get token and addresses
        let eurc_token: Address = env.storage().instance()
            .get(&DataKey::EurcToken)
            .expect("not initialized");
        let commission_addr: Address = env.storage().instance()
            .get(&DataKey::CommissionAddress)
            .expect("not initialized");
        let commission_bps: u32 = env.storage().instance()
            .get(&DataKey::CommissionBps)
            .unwrap_or(50);

        // Calculate amounts
        let commission = (tanda.amount * commission_bps as i128) / 10000;
        let token = TokenClient::new(&env, &eurc_token);

        // Transfer deposit to contract
        token.transfer(&user, &env.current_contract_address(), &tanda.amount);

        // Transfer commission
        if commission > 0 {
            token.transfer(&user, &commission_addr, &commission);
        }

        // Mark as deposited
        let mut member = members.get(idx).unwrap();
        member.has_deposited = true;
        members.set(idx, member);
        env.storage().persistent().set(&DataKey::Members(tanda_id.clone()), &members);

        env.events().publish(
            (Symbol::new(&env, "deposit_made"), user),
            (tanda_id, tanda.current_cycle),
        );
    }

    /// Trigger payout to current beneficiary (anyone can call)
    /// Succeeds only if all active members have deposited
    pub fn trigger_payout(env: Env, tanda_id: String) {
        let mut tanda: Tanda = Self::get_tanda_internal(&env, &tanda_id);

        if tanda.status != TandaStatus::Active {
            panic!("tanda not active");
        }

        let mut members: Vec<Member> = Self::get_members_internal(&env, &tanda_id);

        // Check all non-expelled members have deposited
        let mut all_deposited = true;
        let mut active_count: u32 = 0;
        let mut beneficiary: Option<Address> = None;
        let beneficiary_position = tanda.current_cycle - 1;

        for m in members.iter() {
            if m.status != MemberStatus::Expelled {
                active_count += 1;
                if !m.has_deposited {
                    all_deposited = false;
                }
                // Find beneficiary by position
                if m.position == beneficiary_position && m.status == MemberStatus::Active {
                    beneficiary = Some(m.address.clone());
                }
            }
        }

        if !all_deposited {
            panic!("not all members have deposited");
        }

        let recipient = beneficiary.expect("beneficiary not found");

        // Calculate and transfer payout
        let payout = tanda.amount * active_count as i128;
        let eurc_token: Address = env.storage().instance()
            .get(&DataKey::EurcToken)
            .expect("not initialized");

        let token = TokenClient::new(&env, &eurc_token);
        token.transfer(&env.current_contract_address(), &recipient, &payout);

        // Update member statuses: mark recipient as Received, reset deposits
        let mut new_members: Vec<Member> = Vec::new(&env);
        for m in members.iter() {
            let mut member = m.clone();
            if member.address == recipient {
                member.status = MemberStatus::Received;
            }
            member.has_deposited = false; // Reset for next cycle
            new_members.push_back(member);
        }

        // Advance cycle
        let now = env.ledger().timestamp();
        tanda.current_cycle += 1;
        tanda.last_payout_at = now;

        // Check if tanda is complete
        if tanda.current_cycle > tanda.total_cycles {
            tanda.status = TandaStatus::Completed;
        }

        env.storage().persistent().set(&DataKey::Tanda(tanda_id.clone()), &tanda);
        env.storage().persistent().set(&DataKey::Members(tanda_id.clone()), &new_members);

        env.events().publish(
            (Symbol::new(&env, "payout_sent"), recipient),
            (tanda_id, payout),
        );
    }

    /// Expel a delinquent member (anyone can call)
    /// Succeeds if member hasn't deposited and 6 days have passed since last payout
    pub fn expel_delinquent(env: Env, tanda_id: String, delinquent: Address) {
        let mut tanda: Tanda = Self::get_tanda_internal(&env, &tanda_id);

        if tanda.status != TandaStatus::Active {
            panic!("tanda not active");
        }

        let now = env.ledger().timestamp();
        let deadline = tanda.last_payout_at + (DELINQUENCY_DAYS * SECONDS_PER_DAY);

        if now < deadline {
            panic!("delinquency period not passed");
        }

        let mut members: Vec<Member> = Self::get_members_internal(&env, &tanda_id);

        // Find and validate delinquent
        let mut found = false;
        let mut had_received = false;
        let mut new_members: Vec<Member> = Vec::new(&env);

        for m in members.iter() {
            let mut member = m.clone();
            if member.address == delinquent {
                if member.status == MemberStatus::Expelled {
                    panic!("already expelled");
                }
                if member.has_deposited {
                    panic!("member has deposited");
                }
                had_received = member.status == MemberStatus::Received;
                member.status = MemberStatus::Expelled;
                found = true;
            }
            new_members.push_back(member);
        }

        if !found {
            panic!("member not found");
        }

        // If member hadn't received yet, reduce total cycles
        if !had_received {
            tanda.total_cycles -= 1;
        }

        // Reorder positions for remaining active members
        let mut new_position: u32 = 0;
        let mut reordered_members: Vec<Member> = Vec::new(&env);
        for m in new_members.iter() {
            let mut member = m.clone();
            if member.status != MemberStatus::Expelled {
                member.position = new_position;
                new_position += 1;
            }
            reordered_members.push_back(member);
        }

        env.storage().persistent().set(&DataKey::Tanda(tanda_id.clone()), &tanda);
        env.storage().persistent().set(&DataKey::Members(tanda_id.clone()), &reordered_members);

        env.events().publish(
            (Symbol::new(&env, "member_expelled"), delinquent),
            tanda_id,
        );
    }

    /// Advance the tanda - single action that:
    /// 1. Expels all delinquent members (if 6+ days without deposit)
    /// 2. Triggers payout to beneficiary (if all remaining members deposited)
    /// Anyone can call this function
    pub fn advance(env: Env, tanda_id: String) -> bool {
        let mut tanda: Tanda = Self::get_tanda_internal(&env, &tanda_id);

        if tanda.status != TandaStatus::Active {
            panic!("tanda not active");
        }

        let now = env.ledger().timestamp();
        let deadline = tanda.last_payout_at + (DELINQUENCY_DAYS * SECONDS_PER_DAY);
        let deadline_passed = now >= deadline;

        let mut members: Vec<Member> = Self::get_members_internal(&env, &tanda_id);
        let mut expelled_any = false;

        // Step 1: Expel delinquents if deadline passed
        if deadline_passed {
            let mut new_members: Vec<Member> = Vec::new(&env);

            for m in members.iter() {
                let mut member = m.clone();
                if member.status != MemberStatus::Expelled && !member.has_deposited {
                    // Expel this delinquent
                    let had_received = member.status == MemberStatus::Received;
                    member.status = MemberStatus::Expelled;
                    expelled_any = true;

                    // Reduce cycles if they hadn't received yet
                    if !had_received {
                        tanda.total_cycles -= 1;
                    }

                    env.events().publish(
                        (Symbol::new(&env, "member_expelled"), member.address.clone()),
                        tanda_id.clone(),
                    );
                }
                new_members.push_back(member);
            }

            if expelled_any {
                // Reorder positions
                let mut new_position: u32 = 0;
                let mut reordered: Vec<Member> = Vec::new(&env);
                for m in new_members.iter() {
                    let mut member = m.clone();
                    if member.status != MemberStatus::Expelled {
                        member.position = new_position;
                        new_position += 1;
                    }
                    reordered.push_back(member);
                }
                members = reordered;
            }
        }

        // Step 2: Check if all remaining members have deposited
        let mut all_deposited = true;
        let mut active_count: u32 = 0;
        let mut beneficiary: Option<Address> = None;
        let beneficiary_position = tanda.current_cycle - 1;

        for m in members.iter() {
            if m.status != MemberStatus::Expelled {
                active_count += 1;
                if !m.has_deposited {
                    all_deposited = false;
                }
                if m.position == beneficiary_position && m.status == MemberStatus::Active {
                    beneficiary = Some(m.address.clone());
                }
            }
        }

        // Check if tanda should complete (no active members left or only 1)
        if active_count <= 1 {
            tanda.status = TandaStatus::Completed;
            env.storage().persistent().set(&DataKey::Tanda(tanda_id.clone()), &tanda);
            env.storage().persistent().set(&DataKey::Members(tanda_id.clone()), &members);
            return expelled_any;
        }

        // Step 3: Trigger payout if all deposited
        if all_deposited {
            let recipient = beneficiary.expect("beneficiary not found");

            // Transfer payout
            let payout = tanda.amount * active_count as i128;
            let eurc_token: Address = env.storage().instance()
                .get(&DataKey::EurcToken)
                .expect("not initialized");

            let token = TokenClient::new(&env, &eurc_token);
            token.transfer(&env.current_contract_address(), &recipient, &payout);

            // Update members: mark recipient as Received, reset deposits
            let mut updated_members: Vec<Member> = Vec::new(&env);
            for m in members.iter() {
                let mut member = m.clone();
                if member.address == recipient {
                    member.status = MemberStatus::Received;
                }
                member.has_deposited = false;
                updated_members.push_back(member);
            }
            members = updated_members;

            // Advance cycle
            tanda.current_cycle += 1;
            tanda.last_payout_at = now;

            if tanda.current_cycle > tanda.total_cycles {
                tanda.status = TandaStatus::Completed;
            }

            env.events().publish(
                (Symbol::new(&env, "payout_sent"), recipient),
                (tanda_id.clone(), payout),
            );
        }

        // Save state
        env.storage().persistent().set(&DataKey::Tanda(tanda_id.clone()), &tanda);
        env.storage().persistent().set(&DataKey::Members(tanda_id.clone()), &members);

        expelled_any || all_deposited
    }

    /// Cancel tanda and refund deposits (requires >50% vote)
    /// For simplicity, only creator can cancel while in Forming status
    pub fn cancel_tanda(env: Env, caller: Address, tanda_id: String) {
        caller.require_auth();

        let mut tanda: Tanda = Self::get_tanda_internal(&env, &tanda_id);

        // Only creator can cancel, only in Forming status
        if tanda.creator != caller {
            panic!("only creator can cancel");
        }
        if tanda.status != TandaStatus::Forming {
            panic!("can only cancel while forming");
        }

        tanda.status = TandaStatus::Cancelled;
        env.storage().persistent().set(&DataKey::Tanda(tanda_id.clone()), &tanda);

        env.events().publish(
            (Symbol::new(&env, "tanda_cancelled"), caller),
            tanda_id,
        );
    }

    // ==================== VIEW FUNCTIONS ====================

    /// Get tanda details
    pub fn get_tanda(env: Env, tanda_id: String) -> Tanda {
        Self::get_tanda_internal(&env, &tanda_id)
    }

    /// Get tanda members
    pub fn get_members(env: Env, tanda_id: String) -> Vec<Member> {
        Self::get_members_internal(&env, &tanda_id)
    }

    /// Check if all members have deposited for current cycle
    pub fn all_deposited(env: Env, tanda_id: String) -> bool {
        let members: Vec<Member> = Self::get_members_internal(&env, &tanda_id);

        for m in members.iter() {
            if m.status != MemberStatus::Expelled && !m.has_deposited {
                return false;
            }
        }
        true
    }

    /// Get current beneficiary (who will receive next payout)
    pub fn get_beneficiary(env: Env, tanda_id: String) -> Address {
        let tanda: Tanda = Self::get_tanda_internal(&env, &tanda_id);
        let members: Vec<Member> = Self::get_members_internal(&env, &tanda_id);

        let position = tanda.current_cycle - 1;

        for m in members.iter() {
            if m.position == position && m.status == MemberStatus::Active {
                return m.address.clone();
            }
        }

        panic!("beneficiary not found");
    }

    /// Check if a member can be expelled (6 days passed without deposit)
    pub fn can_expel(env: Env, tanda_id: String, member: Address) -> bool {
        let tanda: Tanda = Self::get_tanda_internal(&env, &tanda_id);

        if tanda.status != TandaStatus::Active {
            return false;
        }

        let now = env.ledger().timestamp();
        let deadline = tanda.last_payout_at + (DELINQUENCY_DAYS * SECONDS_PER_DAY);

        if now < deadline {
            return false;
        }

        let members: Vec<Member> = Self::get_members_internal(&env, &tanda_id);

        for m in members.iter() {
            if m.address == member {
                return m.status != MemberStatus::Expelled && !m.has_deposited;
            }
        }

        false
    }

    /// Get seconds until delinquency deadline
    pub fn time_to_deadline(env: Env, tanda_id: String) -> u64 {
        let tanda: Tanda = Self::get_tanda_internal(&env, &tanda_id);
        let now = env.ledger().timestamp();
        let deadline = tanda.last_payout_at + (DELINQUENCY_DAYS * SECONDS_PER_DAY);

        if now >= deadline {
            return 0;
        }

        deadline - now
    }

    /// Get status for "Advance" button - what will happen if called
    /// Returns: (can_advance, will_expel_count, will_payout, beneficiary_if_payout)
    pub fn get_advance_status(env: Env, tanda_id: String) -> (bool, u32, bool, Option<Address>) {
        let tanda: Tanda = Self::get_tanda_internal(&env, &tanda_id);

        if tanda.status != TandaStatus::Active {
            return (false, 0, false, None);
        }

        let now = env.ledger().timestamp();
        let deadline = tanda.last_payout_at + (DELINQUENCY_DAYS * SECONDS_PER_DAY);
        let deadline_passed = now >= deadline;

        let members: Vec<Member> = Self::get_members_internal(&env, &tanda_id);

        // Count who would be expelled
        let mut expel_count: u32 = 0;
        let mut remaining_deposited: u32 = 0;
        let mut remaining_total: u32 = 0;
        let mut beneficiary: Option<Address> = None;
        let beneficiary_position = tanda.current_cycle - 1;

        for m in members.iter() {
            if m.status == MemberStatus::Expelled {
                continue;
            }

            let would_be_expelled = deadline_passed && !m.has_deposited;

            if would_be_expelled {
                expel_count += 1;
            } else {
                remaining_total += 1;
                if m.has_deposited {
                    remaining_deposited += 1;
                }
                // Find beneficiary among non-expelled
                if m.position == beneficiary_position && m.status == MemberStatus::Active {
                    beneficiary = Some(m.address.clone());
                }
            }
        }

        // Would payout happen after expulsions?
        let will_payout = remaining_total > 1 && remaining_deposited == remaining_total;

        // Can advance if something would happen
        let can_advance = expel_count > 0 || will_payout;

        (can_advance, expel_count, will_payout, beneficiary)
    }

    // ==================== INTERNAL HELPERS ====================

    fn get_tanda_internal(env: &Env, tanda_id: &String) -> Tanda {
        env.storage().persistent()
            .get(&DataKey::Tanda(tanda_id.clone()))
            .expect("tanda not found")
    }

    fn get_members_internal(env: &Env, tanda_id: &String) -> Vec<Member> {
        env.storage().persistent()
            .get(&DataKey::Members(tanda_id.clone()))
            .unwrap_or(Vec::new(env))
    }

    fn generate_id(env: &Env, count: u32) -> String {
        // Simple numeric ID
        let mut chars = [b'0'; 8];
        let mut n = count;
        for i in 0..8 {
            chars[7 - i] = b'0' + (n % 10) as u8;
            n /= 10;
        }
        String::from_str(env, core::str::from_utf8(&chars).unwrap())
    }
}

// ==================== TESTS ====================

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::{Address as _, Ledger, LedgerInfo};

    fn setup_env() -> (Env, Address, Address, Address) {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let eurc = env.register_stellar_asset_contract_v2(admin.clone()).address();
        let commission = Address::generate(&env);

        (env, admin, eurc, commission)
    }

    #[test]
    fn test_create_and_start_tanda() {
        let (env, admin, eurc, commission) = setup_env();

        let contract_id = env.register_contract(None, TandaContract);
        let client = TandaContractClient::new(&env, &contract_id);

        client.initialize(&admin, &eurc, &commission, &50);

        let creator = Address::generate(&env);
        let member2 = Address::generate(&env);
        let name = String::from_str(&env, "Test Tanda");

        // Create tanda
        let tanda_id = client.create_tanda(&creator, &name, &100_0000000, &5);

        // Join
        client.join_tanda(&member2, &tanda_id);

        // Start
        client.start_tanda(&creator, &tanda_id);

        let tanda = client.get_tanda(&tanda_id);
        assert_eq!(tanda.status, TandaStatus::Active);
        assert_eq!(tanda.current_cycle, 1);
        assert_eq!(tanda.total_cycles, 2);
    }

    #[test]
    fn test_deposit_and_payout() {
        let (env, admin, eurc, commission) = setup_env();

        let contract_id = env.register_contract(None, TandaContract);
        let client = TandaContractClient::new(&env, &contract_id);

        client.initialize(&admin, &eurc, &commission, &50);

        let creator = Address::generate(&env);
        let member2 = Address::generate(&env);
        let name = String::from_str(&env, "Test Tanda");

        // Setup tanda
        let tanda_id = client.create_tanda(&creator, &name, &100_0000000, &5);
        client.join_tanda(&member2, &tanda_id);
        client.start_tanda(&creator, &tanda_id);

        // Mint tokens and deposit
        let token = TokenClient::new(&env, &eurc);
        token.mint(&creator, &200_0000000);
        token.mint(&member2, &200_0000000);

        client.deposit(&creator, &tanda_id);
        client.deposit(&member2, &tanda_id);

        // Check all deposited
        assert!(client.all_deposited(&tanda_id));

        // Trigger payout
        client.trigger_payout(&tanda_id);

        let tanda = client.get_tanda(&tanda_id);
        assert_eq!(tanda.current_cycle, 2);
    }

    #[test]
    fn test_expel_delinquent() {
        let (env, admin, eurc, commission) = setup_env();

        let contract_id = env.register_contract(None, TandaContract);
        let client = TandaContractClient::new(&env, &contract_id);

        client.initialize(&admin, &eurc, &commission, &50);

        let creator = Address::generate(&env);
        let delinquent = Address::generate(&env);
        let name = String::from_str(&env, "Test Tanda");

        // Setup
        let tanda_id = client.create_tanda(&creator, &name, &100_0000000, &5);
        client.join_tanda(&delinquent, &tanda_id);
        client.start_tanda(&creator, &tanda_id);

        // Only creator deposits
        let token = TokenClient::new(&env, &eurc);
        token.mint(&creator, &200_0000000);
        client.deposit(&creator, &tanda_id);

        // Advance time 7 days
        env.ledger().set(LedgerInfo {
            timestamp: env.ledger().timestamp() + (7 * 86400),
            protocol_version: 20,
            sequence_number: 0,
            network_id: Default::default(),
            base_reserve: 10,
            min_temp_entry_ttl: 0,
            min_persistent_entry_ttl: 0,
            max_entry_ttl: 0,
        });

        // Can expel
        assert!(client.can_expel(&tanda_id, &delinquent));

        // Expel
        client.expel_delinquent(&tanda_id, &delinquent);

        // Check expelled
        let members = client.get_members(&tanda_id);
        for m in members.iter() {
            if m.address == delinquent {
                assert_eq!(m.status, MemberStatus::Expelled);
            }
        }
    }
}
