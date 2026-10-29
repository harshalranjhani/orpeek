#include <Security/Security.h>
#include <CoreFoundation/CoreFoundation.h>
#include <stdio.h>
#include <string.h>
#include <unistd.h>

int main(int argc, char **argv) {
  if (argc != 2) return 1;
  const char *service = "com.orpeek.openrouter", *account = "default";
  UInt32 length = 0; void *data = NULL; SecKeychainItemRef item = NULL;
  OSStatus status = SecKeychainFindGenericPassword(NULL, (UInt32)strlen(service), service,
      (UInt32)strlen(account), account, &length, &data, &item);
  if (!strcmp(argv[1], "get")) {
    if (status == errSecItemNotFound) return 2;
    if (status != errSecSuccess) return 3;
    fwrite(data, 1, length, stdout);
  } else if (!strcmp(argv[1], "remove")) {
    if (status == errSecItemNotFound) return 0;
    if (status == errSecSuccess) status = SecKeychainItemDelete(item);
  } else if (!strcmp(argv[1], "set")) {
    unsigned char secret[4097]; size_t n = fread(secret, 1, sizeof(secret), stdin);
    if (!n || n > 4096 || ferror(stdin)) return 1;
    if (status == errSecSuccess) status = SecKeychainItemModifyAttributesAndData(item, NULL, (UInt32)n, secret);
    else if (status == errSecItemNotFound) status = SecKeychainAddGenericPassword(NULL,
      (UInt32)strlen(service), service, (UInt32)strlen(account), account, (UInt32)n, secret, NULL);
    volatile unsigned char *wipe = secret;
    for (size_t i = 0; i < sizeof(secret); i++) wipe[i] = 0;
  } else return 1;
  if (data) SecKeychainItemFreeContent(NULL, data);
  if (item) CFRelease(item);
  return status == errSecSuccess ? 0 : 3;
}
