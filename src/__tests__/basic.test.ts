import { expect, it } from "vitest";
import { Marmot } from "..";

it("should handle basic MLS workflow: create group, add member, exchange messages", async () => {
  const marmot = new Marmot();

  // Setup Alice's credential and key package
  const aliceCredential = marmot.createCredential("alice_pubkey");
  const aliceKeyPackage = await marmot.createKeyPackage(aliceCredential);

  // Alice creates a new group
  let aliceGroup = await marmot.createGroup(aliceKeyPackage);

  // Setup Bob's credential and key package
  const bobCredential = marmot.createCredential("bob_pubkey");
  const bobKeyPackage = await marmot.createKeyPackage(bobCredential);

  // Alice creates a proposal to add Bob to the group
  const addBobProposal = {
    proposalType: "add" as const,
    add: { keyPackage: bobKeyPackage.publicPackage },
  };

  // Alice commits the proposal
  const commitResult = await marmot.createCommit(aliceGroup, [addBobProposal]);
  aliceGroup = commitResult.newState;

  // Verify the commit result has a welcome message
  expect(commitResult.welcome).toBeDefined();

  // Bob joins the group using the welcome message
  let bobGroup = await marmot.joinGroup(
    commitResult.welcome!,
    bobKeyPackage,
    aliceGroup.ratchetTree,
  );

  // Alice sends a message to Bob
  const messageText = "Hello bob!";
  const aliceMessageResult = await marmot.createMessage(
    aliceGroup,
    messageText,
  );
  aliceGroup = aliceMessageResult.newState;

  // Encode the private message for transmission
  const encodedPrivateMessage = {
    privateMessage: aliceMessageResult.privateMessage,
    wireformat: "mls_private_message" as const,
    version: "mls10" as const,
  };

  // Bob processes Alice's message
  const bobProcessResult = await marmot.processMessage(
    bobGroup,
    encodedPrivateMessage,
  );
  bobGroup = bobProcessResult.newState;

  // Verify Bob received the correct message
  if (bobProcessResult.kind === "newState") {
    throw new Error("Expected application message");
  }
  const decodedMessage = new TextDecoder().decode(bobProcessResult.message);
  expect(decodedMessage).toBe(messageText);

  // Verify both groups are synchronized (we can check other properties since epoch might not be directly accessible)
  expect(aliceGroup.groupContext.groupId).toEqual(
    bobGroup.groupContext.groupId,
  );
});
