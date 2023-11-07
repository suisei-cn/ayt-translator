{pkgs ? import <nixpkgs> {}}:
pkgs.mkShell {
  buildInputs = with pkgs; [openssl];
  nativeBuildInputs = with pkgs; [rustup pkg-config yarn];
}
