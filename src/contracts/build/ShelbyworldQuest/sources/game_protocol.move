module game_addr::game_protocol {
    use std::signer;
    use std::string::{Self, String};
    use std::option;
    use std::bcs;
    use aptos_framework::account::{Self, SignerCapability};
    use aptos_framework::resource_account;
    use aptos_token_objects::collection;
    use aptos_token_objects::token;
    use aptos_token_objects::property_map;
    use aptos_framework::object;

    const EALREADY_INITIALIZED: u64 = 1;
    const EMINIMUM_SCORE_NOT_MET: u64 = 2;
    const ENOT_AUTHORIZED: u64 = 3;

    // Stores the Resource Account's signer capability inside the contract storage
    struct ModuleData has key {
        signer_cap: SignerCapability,
    }

    /// Initializes the collection under the Resource Account during package deployment.
    fun init_module(resource_signer: &signer) {
        let collection_name = string::utf8(b"Shelbyworld Quest Passport");
        let description = string::utf8(b"The official Shelbyworld Quest dynamic passport representing verified player credit scores.");
        let uri = string::utf8(b"https://shelby.shelbynet.staging.shelby.xyz/shelby/v1/blobs/collection.json");
        let max_supply = 100000;

        // Create the collection under the Resource Account's ownership
        collection::create_fixed_collection(
            resource_signer,
            description,
            max_supply,
            collection_name,
            option::none(),
            uri,
        );

        // Retrieve and store the Signer Capability
        // @admin_addr is the publisher/source address that initiated this transaction
        let signer_cap = resource_account::retrieve_resource_account_cap(resource_signer, @admin_addr);
        move_to(resource_signer, ModuleData {
            signer_cap,
        });
    }

    /// Player mints their unique passport NFT, saving their final score directly to the on-chain property map.
 /// Player mints their unique passport NFT, saving their final score directly to the on-chain property map.
    public entry fun mint_passport(
        player: &signer,
        score: u64
    ) acquires ModuleData {
        // Assert player met the 100 points minimum score to prevent fraud
        assert!(score >= 100, EMINIMUM_SCORE_NOT_MET);

        let player_addr = signer::address_of(player);

        // 1. Retrieve the Resource Signer from contract storage located at @game_addr
        let module_data = borrow_global<ModuleData>(@game_addr);
        
        // CORRECTED: Replaced -> with .
        let resource_signer = account::create_signer_with_capability(&module_data.signer_cap);

        let collection_name = string::utf8(b"Shelbyworld Quest Passport");
        let token_name = string::utf8(b"Shelby Quest Passport");
        let description = string::utf8(b"An on-chain verifiable Shelbyworld passport containing your scavenger hunt score.");
        let token_uri = string::utf8(b"https://shelby.shelbynet.staging.shelby.xyz/shelby/v1/blobs/passport_art.json");

        // 2. Mint the token under the Resource Signer's name (the valid collection creator!)
        let constructor_ref = token::create_from_account(
            &resource_signer, // Creator signer
            collection_name,
            description,
            token_name,
            option::none(),
            token_uri,
        );

        // Prepare the credits metadata score
        let property_keys = vector[string::utf8(b"credits")];
        let property_types = vector[string::utf8(b"u64")];
        let property_values = vector[bcs::to_bytes(&score)];

        // Initialize the metadata map inside the token constructor
        let properties = property_map::prepare_input(property_keys, property_types, property_values);
        property_map::init(&constructor_ref, properties);

        // 3. Automatically transfer the newly minted NFT to the player's wallet address
        let token_obj = object::object_from_constructor_ref<token::Token>(&constructor_ref);
        object::transfer(&resource_signer, token_obj, player_addr);
    }
}